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
  if (!response.ok) {
    const detail = yield* Effect.tryPromise(() => response.text()).pipe(Effect.orElseSucceed(() => ""))
    return yield* new MissingCredential({ name: `sarvam:${response.status}:${clip(detail)}` })
  }
  const body: unknown = yield* Effect.tryPromise(() => response.json())
  const envelope = yield* Schema.decodeUnknownEffect(SarvamEnvelope)(body)
  const message = recordOf(envelope.choices[0]?.message)
  const content = textOf(message?.content)
  const reasoning = typeof message?.reasoning_content === "string" ? message.reasoning_content : ""
  const raw = jsonObjectSafe(content) ?? jsonObjectSafe(reasoning) ?? jsonObjectSafe(`${reasoning}\n${content}`)
  if (!raw) return yield* new MissingCredential({ name: `sarvam:json:${clip(content || reasoning || "empty")}` })
  const parsed = yield* Effect.try({
    try: () => JSON.parse(raw),
    catch: () => new MissingCredential({ name: `sarvam:json:${clip(raw)}` }),
  })
  return yield* Schema.decodeUnknownEffect(ModelProposal)(parsed)
})

const SarvamEnvelope = Schema.Struct({
  choices: Schema.Array(Schema.Struct({ message: Schema.Unknown })),
})

const textOf = (content: unknown): string => {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) => {
      if (typeof part === "string") return part
      if (part && typeof part === "object" && "text" in part) return String(part.text)
      return ""
    })
    .join("")
}

const jsonObject = (raw: string): string => {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced?.[1] ?? raw
  const start = body.indexOf("{")
  const end = body.lastIndexOf("}")
  if (start < 0 || end < start) throw new Error("no json object")
  return body.slice(start, end + 1)
}

const jsonObjectSafe = (raw: string): string | null => {
  if (!raw) return null
  try {
    const sliced = jsonObject(raw)
    JSON.parse(sliced)
    return sliced
  } catch {
    return null
  }
}

const clip = (value: string): string => value.replace(/\+?\d{8,}/g, "•").replace(/\s+/g, " ").slice(0, 160)

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
  if (!response.ok) {
    const detail = yield* Effect.tryPromise(() => response.text()).pipe(Effect.orElseSucceed(() => ""))
    return yield* new MissingCredential({ name: `bolna:${response.status}:${clip(detail)}` })
  }
  const body: unknown = yield* Effect.tryPromise(() => response.json())
  const parsed = yield* Schema.decodeUnknownEffect(
    Schema.Struct({
      execution_id: Schema.optional(Schema.String),
      executionId: Schema.optional(Schema.String),
      message: Schema.optional(Schema.String),
    }),
  )(body)
  const id = parsed.execution_id ?? parsed.executionId
  if (!id) return yield* new MissingCredential({ name: `bolna:execution_id:${clip(parsed.message ?? "")}` })
  return Schema.decodeUnknownSync(ExecutionId)(id)
})

export type CompletedCall = {
  executionId: ExecutionId
  durationMs: number
  costPaise: number
  transcript: string
  extractions: Extraction
}

export type CallDetails = {
  status: string
  summary: string | null
  recording_url: string | null
  termination_reason: string | null
  error_message: string | null
  created_at: string | null
  updated_at: string | null
  initiated_at: string | null
  provider: string | null
  processing_status: string | null
  extracted_data: unknown
  custom_extractions: unknown
  cost_breakdown: unknown
}

export type ExecutionRead =
  | { _tag: "Pending"; details?: CallDetails }
  | { _tag: "Ended"; status: string; details: CallDetails }
  | { _tag: "Completed"; call: CompletedCall; details: CallDetails }

const endedStatuses = new Set(["balance-low", "busy", "no-answer", "canceled", "failed", "stopped", "error"])

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
  const telephony = recordOf(loose.telephony_data)
  const nullableText = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null
  const details: CallDetails = {
    status: loose.status,
    summary: nullableText(loose.summary),
    recording_url: safeRecordingUrl(telephony?.recording_url),
    termination_reason: nullableText(loose.termination_reason) ?? nullableText(telephony?.hangup_reason),
    error_message: nullableText(loose.error_message),
    created_at: nullableText(loose.created_at),
    updated_at: nullableText(loose.updated_at),
    initiated_at: nullableText(loose.initiated_at),
    provider: nullableText(loose.provider) ?? nullableText(telephony?.provider),
    processing_status: nullableText(loose.processing_status),
    extracted_data: loose.extracted_data ?? null,
    custom_extractions: loose.custom_extractions ?? null,
    cost_breakdown: loose.cost_breakdown ?? null,
  }
  if (loose.status === "completed") {
    const durationSeconds = typeof telephony?.duration === "number" ? telephony.duration : Number(loose.conversation_duration) || 0
    const costNumber = typeof loose.total_cost === "number" ? loose.total_cost : Number(loose.total_cost)
    const cost = Number.isFinite(costNumber) ? Math.round(costNumber * 100) : 0
    return {
      _tag: "Completed",
      details,
      call: {
        executionId: Schema.decodeUnknownSync(ExecutionId)(executionId),
        durationMs: Math.round(durationSeconds * 1000),
        costPaise: cost,
        transcript: asText(loose.transcript),
        extractions: extractionFrom(loose.extracted_data),
      },
    } satisfies ExecutionRead
  }
  if (endedStatuses.has(loose.status)) return { _tag: "Ended", status: loose.status, details } satisfies ExecutionRead
  return { _tag: "Pending", details } satisfies ExecutionRead
})

const BolnaExecution = Schema.Struct({
  status: Schema.String,
  transcript: Schema.optional(Schema.Unknown),
  total_cost: Schema.optional(Schema.Unknown),
  telephony_data: Schema.optional(Schema.Unknown),
  extracted_data: Schema.optional(Schema.Unknown),
  custom_extractions: Schema.optional(Schema.Unknown),
  summary: Schema.optional(Schema.Unknown),
  termination_reason: Schema.optional(Schema.Unknown),
  error_message: Schema.optional(Schema.Unknown),
  created_at: Schema.optional(Schema.Unknown),
  updated_at: Schema.optional(Schema.Unknown),
  initiated_at: Schema.optional(Schema.Unknown),
  provider: Schema.optional(Schema.Unknown),
  processing_status: Schema.optional(Schema.Unknown),
  conversation_duration: Schema.optional(Schema.Unknown),
  cost_breakdown: Schema.optional(Schema.Unknown),
})

export const safeRecordingUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

const recordOf = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const asText = (value: unknown): string => {
  if (typeof value === "string") return value
  if (!Array.isArray(value)) return ""
  return value
    .map((item) => {
      if (typeof item === "string") return item
      const record = recordOf(item)
      if (!record) return ""
      const content = record.content ?? record.message ?? record.text
      return typeof content === "string" ? content : ""
    })
    .filter((line) => line.length > 0)
    .join("\n")
}

const extractionFrom = (data: unknown): Extraction => {
  const record = recordOf(data)
  const intent = record?.customer_intent
  const explicit = normalizeDay(record?.reattempt_date)
  if (intent === "denied") return { _tag: "Denied" }
  if (explicit && intent === "confirmed" && (!record?.review_reason || record.review_reason === "none")) {
    return { _tag: "Confirmed", day: explicit }
  }
  return { _tag: "Unclear" }
}

const todayIst = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())

const addDays = (day: string, count: number): string => {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

const normalizeDay = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const text = value.trim().toLowerCase()
  const today = todayIst()
  if (text === "today") return today
  if (text === "tomorrow") return addDays(today, 1)
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  return iso?.[1] ?? null
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
