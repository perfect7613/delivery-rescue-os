import { Effect, Schema } from "effect"
import {
  ConnectorUnavailable,
  ExecutionId,
  Extraction,
  MissingCredential,
  ModelProposal,
  NotReady,
  type RenderedPrompt,
} from "@rescue/shared"

const env = (name: string): Effect.Effect<string, MissingCredential> => {
  const value = process.env[name]
  if (!value) return Effect.fail(new MissingCredential({ name }))
  return Effect.succeed(value)
}

const bearer = (token: string) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
})

export const planWithSarvam = Effect.fn("planWithSarvam")(function* (prompt: RenderedPrompt) {
  const key = yield* env("SARVAM_API_KEY")
  const base = process.env.SARVAM_BASE_URL ?? "https://api.sarvam.ai"
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`${base.replace(/\/$/, "")}/v2/chat/completions`, {
        method: "POST",
        headers: bearer(key),
        body: JSON.stringify({
          model: "glm5.3-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      }),
    catch: (cause) => cause,
  })
  if (!response.ok) return yield* Effect.fail(new MissingCredential({ name: `sarvam:${response.status}` }))
  const body: unknown = yield* Effect.tryPromise(() => response.json())
  const envelope = yield* Schema.decodeUnknownEffect(SarvamEnvelope)(body)
  const content = envelope.choices[0]?.message.content
  if (!content) return yield* new MissingCredential({ name: "sarvam:empty" })
  const parsed = yield* Effect.try({
    try: () => JSON.parse(content),
    catch: () => new MissingCredential({ name: "sarvam:json" }),
  })
  return yield* Schema.decodeUnknownEffect(ModelProposal)(parsed)
})

const SarvamEnvelope = Schema.Struct({
  choices: Schema.Array(Schema.Struct({ message: Schema.Struct({ content: Schema.String }) })),
})

export const placeBolnaCall = Effect.fn("placeBolnaCall")(function* (input: {
  phone: string
  caseId: string
  idempotencyKey: string
}) {
  const key = yield* env("BOLNA_API_KEY")
  const agentId = yield* env("BOLNA_AGENT_ID")
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch("https://api.bolna.ai/call", {
        method: "POST",
        headers: bearer(key),
        body: JSON.stringify({
          agent_id: agentId,
          recipient_phone_number: input.phone,
          user_data: { caseId: input.caseId, idempotencyKey: input.idempotencyKey },
        }),
      }),
    catch: (cause) => cause,
  })
  if (!response.ok) return yield* Effect.fail(new MissingCredential({ name: `bolna:${response.status}` }))
  const body: unknown = yield* Effect.tryPromise(() => response.json())
  const parsed = yield* Schema.decodeUnknownEffect(
    Schema.Struct({ execution_id: Schema.optional(Schema.String), executionId: Schema.optional(Schema.String) }),
  )(body)
  const id = parsed.execution_id ?? parsed.executionId
  if (!id) return yield* Effect.fail(new MissingCredential({ name: "bolna:execution_id" }))
  return Schema.decodeUnknownSync(ExecutionId)(id)
})

export type CompletedCall = {
  executionId: ExecutionId
  durationMs: number
  costPaise: number
  transcript: string
  extractions: Extraction
}

export const readBolnaExecution = Effect.fn("readBolnaExecution")(function* (executionId: string) {
  const key = yield* env("BOLNA_API_KEY")
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`https://api.bolna.ai/executions/${executionId}`, { headers: { authorization: `Bearer ${key}` } }),
    catch: (cause) => cause,
  })
  if (!response.ok) return yield* new NotReady({ executionId })
  const body: unknown = yield* Effect.tryPromise(() => response.json())
  const loose = yield* Schema.decodeUnknownEffect(BolnaExecution)(body).pipe(
    Effect.catch(() => Effect.fail(new NotReady({ executionId }))),
  )
  if (loose.status !== "completed") return yield* new NotReady({ executionId })
  const durationSeconds = typeof loose.telephony_data?.duration === "number" ? loose.telephony_data.duration : 0
  const cost = typeof loose.total_cost === "number" ? Math.round(loose.total_cost * 100) : 0
  return {
    executionId: Schema.decodeUnknownSync(ExecutionId)(executionId),
    durationMs: Math.round(durationSeconds * 1000),
    costPaise: cost,
    transcript: loose.transcript ?? "",
    extractions: extractionFrom(loose.extracted_data),
  } satisfies CompletedCall
})

const BolnaExecution = Schema.Struct({
  status: Schema.String,
  transcript: Schema.optional(Schema.String),
  total_cost: Schema.optional(Schema.Number),
  telephony_data: Schema.optional(Schema.Struct({ duration: Schema.optional(Schema.Number) })),
  extracted_data: Schema.optional(
    Schema.Struct({
      customer_intent: Schema.optional(Schema.String),
      reattempt_date: Schema.optional(Schema.String),
    }),
  ),
})

const extractionFrom = (
  data: { customer_intent?: string; reattempt_date?: string } | undefined,
): Extraction => {
  if (data?.customer_intent === "denied") return { _tag: "Denied" }
  if (data?.customer_intent === "confirmed" && data.reattempt_date) {
    return { _tag: "Confirmed", day: data.reattempt_date }
  }
  return { _tag: "Unclear" }
}

export const registry = [
  { id: "demo-carrier", kind: "logistics", availability: "ready" },
  { id: "shiprocket", kind: "logistics", availability: "ready" },
  { id: "bolna", kind: "voice", availability: "ready" },
  { id: "sarvam", kind: "ai", availability: "ready" },
  { id: "whatsapp", kind: "notifications", availability: "coming_soon" },
  { id: "email", kind: "notifications", availability: "coming_soon" },
  { id: "commerce_store", kind: "commerce", availability: "coming_soon" },
] as const

export const testConnection = Effect.fn("testConnection")(function* (connectorId: string) {
  const entry = registry.find((item) => item.id === connectorId)
  if (!entry || entry.availability === "coming_soon") {
    return yield* new ConnectorUnavailable({ connectorId })
  }
  if (connectorId === "sarvam") {
    yield* env("SARVAM_API_KEY")
    return { ok: true as const }
  }
  if (connectorId === "bolna") {
    const key = yield* env("BOLNA_API_KEY")
    const response = yield* Effect.tryPromise(() =>
      fetch("https://api.bolna.ai/user/me", { headers: { authorization: `Bearer ${key}` } }),
    )
    if (!response.ok) return yield* new MissingCredential({ name: `bolna:${response.status}` })
    return { ok: true as const }
  }
  return { ok: true as const }
})
