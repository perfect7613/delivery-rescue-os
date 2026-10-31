import { Cause, Context, Deferred, Effect, Layer, Schema } from "effect"
import postgres from "postgres"
import { placeBolnaCall, planWithSarvam, readBolnaExecution } from "@rescue/connectors"
import {
  isClosed,
  phaseLabel,
  reduce,
  renderPrompt,
  reviewReasonOf,
  toPromptFacts,
  type CarrierStatus,
  type CaseSnapshot,
  type LogisticsMode,
  type OpenPhase,
  type ReduceResult,
  type ReviewReason,
  type RowWrite,
  type UnresolvedReason,
} from "@rescue/domain"
import {
  DemoOrgId,
  DomainEvent,
  ExecutionId,
  LeaseLost,
  MissingCredential,
  NotReady,
  RenderedPrompt,
  mintDedup,
  type DedupKey,
} from "@rescue/shared"
import { decryptSecret } from "@rescue/shared/secrets"

type Sql = postgres.Sql | postgres.TransactionSql

const JobPayload = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("ApplyEvent"), inboxId: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("Plan"), caseId: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("PlaceCall"), caseId: Schema.String, voiceCallId: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("PollCall"), caseId: Schema.String, executionId: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("SubmitReattempt"), caseId: Schema.String, version: Schema.Number }),
])
type JobPayload = typeof JobPayload.Type

type Claimed = { id: string; orgId: string; dedupKey: string; payload: JobPayload }

const todayIst = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())

const workerId = (): string => process.env.WORKER_ID || "rescue-worker-1"

const tagged = (error: unknown): string | null => {
  if (typeof error === "object" && error !== null && "_tag" in error && typeof error._tag === "string") return error._tag
  return null
}

const errorText = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/Bearer\s+\S+/gi, "Bearer •").slice(0, 300)
}

export class Harness extends Context.Service<Harness, { readonly run: Effect.Effect<void> }>()("delivery-rescue/Harness") {
  static readonly layer = Layer.effect(
    Harness,
    Effect.gen(function* () {
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) {
        return Harness.of({
          run: Effect.gen(function* () {
            while (true) {
              yield* Effect.logError("DATABASE_URL is empty. The worker stays resident and retries.")
              yield* Effect.sleep("10 seconds")
            }
          }),
        })
      }
      const sql = postgres(databaseUrl, { ssl: "require", max: 4 })
      const run = Effect.gen(function* () {
        yield* Effect.logInfo(`rescue worker ${workerId()} is armed`)
        while (true) yield* tick(sql)
      }).pipe(Effect.ensuring(Effect.sync(() => sql.end())))
      return Harness.of({ run })
    }),
  )
}

const tick = (sql: postgres.Sql) =>
  Effect.gen(function* () {
    const claimed = yield* claim(sql)
    if (!claimed) {
      yield* touch(sql, "idle", null)
      yield* Effect.sleep("400 millis")
      return false
    }
    yield* touch(sql, "running", claimed.dedupKey)
    yield* runClaimed(sql, claimed)
    return true
  }).pipe(
    Effect.catch((error) =>
      Effect.logError(`worker tick failed: ${String(error)}`).pipe(
        Effect.andThen(Effect.sleep("2 seconds")),
        Effect.as(false),
      ),
    ),
  )

/** Runs the same claim loop as the resident worker, then closes its connection. */
export const processFor = (budgetMs: number, stopWhenIdle = false) =>
  Effect.gen(function* () {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      yield* Effect.logError("DATABASE_URL is empty. The worker stays resident and retries.")
      return
    }
    const sql = postgres(databaseUrl, { ssl: "require", max: 1, idle_timeout: 5, connect_timeout: 10 })
    yield* Effect.gen(function* () {
      yield* Effect.logInfo(`rescue worker ${workerId()} is armed for ${budgetMs}ms`)
      const deadline = Date.now() + budgetMs
      let idle = 0
      while (Date.now() < deadline) {
        const worked = yield* tick(sql)
        if (worked) idle = 0
        else idle += 1
        if (stopWhenIdle && idle >= 2) return
      }
    }).pipe(Effect.ensuring(Effect.promise(() => sql.end({ timeout: 5 }))))
  })

const claim = (sql: postgres.Sql) =>
  Effect.tryPromise(async () => {
    const rows = await sql<Array<{ id: string; org_id: string; dedup_key: string; payload: unknown }>>`
      select * from claim_job(${workerId()})
    `
    const row = rows[0]
    if (!row) return null
    const payload = Schema.decodeUnknownSync(JobPayload)(row.payload)
    return { id: row.id, orgId: row.org_id, dedupKey: row.dedup_key, payload } satisfies Claimed
  })

const touch = (sql: postgres.Sql, status: "running" | "idle", job: string | null) =>
  Effect.tryPromise(() =>
    sql`
      insert into worker_status (worker_id, status, last_seen_at, booted_at, last_job_dedup)
      values (${workerId()}, ${status}, now(), now(), ${job})
      on conflict (worker_id) do update
        set status = excluded.status,
            last_seen_at = now(),
            last_job_dedup = excluded.last_job_dedup
    `,
  )

const heartbeat = (sql: postgres.Sql, jobId: string) =>
  Effect.tryPromise(async () => {
    const rows = await sql`
      update workflow_jobs
      set lease_expires_at = now() + interval '30 seconds'
      where id = ${jobId}::uuid and claimed_by = ${workerId()} and status = 'running'
      returning id
    `
    return rows.length > 0
  })

const runClaimed = (sql: postgres.Sql, job: Claimed) =>
  Effect.gen(function* () {
    const lost = yield* Deferred.make<void>()
    yield* Effect.forkChild(
      Effect.gen(function* () {
        while (true) {
          yield* Effect.sleep("10 seconds")
          const held = yield* heartbeat(sql, job.id)
          if (!held) {
            yield* Deferred.succeed(lost, undefined)
            return
          }
        }
      }),
    )
    const exit = yield* Effect.exit(
      Effect.raceFirst(
        dispatch(sql, job),
        Deferred.await(lost).pipe(Effect.andThen(Effect.fail(new LeaseLost({ jobId: job.id })))),
      ),
    )
    if (exit._tag === "Success") return
    const reason = Cause.squash(exit.cause)
    const tag = tagged(reason)
    if (tag === "LeaseLost") {
      yield* Effect.logWarning(`lease lost on ${job.dedupKey}`)
      return
    }
    if (tag === "NotReady") return
    if (tag === "MissingCredential") {
      const name = typeof reason === "object" && reason !== null && "name" in reason ? String(reason.name) : "credential"
      yield* Effect.logInfo(`waiting on ${name}`)
      yield* releaseWaiting(sql, job.id)
      return
    }
    yield* Effect.logError(`job ${job.dedupKey} failed: ${errorText(reason)}`)
    yield* releaseFailed(sql, job)
  })

const dispatch = (sql: postgres.Sql, job: Claimed) => {
  switch (job.payload._tag) {
    case "ApplyEvent":
      return applyInbox(sql, job)
    case "Plan":
      return plan(sql, job)
    case "PlaceCall":
      return place(sql, job)
    case "PollCall":
      return poll(sql, job)
    case "SubmitReattempt":
      return submit(sql, job)
    default: {
      const _exhaustive: never = job.payload
      return Effect.die(_exhaustive)
    }
  }
}

const plan = (sql: postgres.Sql, job: Claimed) =>
  Effect.gen(function* () {
    if (job.payload._tag !== "Plan") return
    const snapshot = yield* loadByCase(sql, job.payload.caseId)
    const prompt = Schema.decodeUnknownSync(RenderedPrompt)(renderPrompt(toPromptFacts(snapshot)))
    const proposal = yield* planWithSarvam(prompt).pipe(
      Effect.catch((error) => {
        if (error instanceof MissingCredential) return Effect.fail(error)
        return Effect.fail(error)
      }),
    )
    const runId = job.payload.caseId
    yield* accept(sql, {
      orgId: job.orgId,
      dedupKey: mintDedup(`model:${runId}:proposal`),
      source: "sarvam",
      shipmentId: snapshot.shipment.id,
      payload: { _tag: "ModelProposal", dedupKey: mintDedup(`model:${runId}:proposal`), runId, proposal },
    })
    yield* succeed(sql, job.id)
  }).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        if (tagged(error) !== "MissingCredential" && job.payload._tag === "Plan") {
          const snapshot = yield* loadByCase(sql, job.payload.caseId)
          yield* accept(sql, {
            orgId: job.orgId,
            dedupKey: mintDedup(`model:${job.payload.caseId}:rejected`),
            source: "sarvam",
            shipmentId: snapshot.shipment.id,
            payload: {
              _tag: "ModelRejected",
              dedupKey: mintDedup(`model:${job.payload.caseId}:rejected`),
              runId: job.payload.caseId,
            },
          })
          yield* succeed(sql, job.id)
          return
        }
        return yield* Effect.fail(error)
      }),
    ),
  )

const place = (sql: postgres.Sql, job: Claimed) =>
  Effect.gen(function* () {
    if (job.payload._tag !== "PlaceCall") return
    const voiceCallId = job.payload.voiceCallId
    const caseId = job.payload.caseId
    const existing = yield* Effect.tryPromise(
      () => sql<{ execution_id: string | null }[]>`
        select execution_id from voice_calls where id = ${voiceCallId}::uuid
      `,
    )
    const stored = existing[0]?.execution_id
    if (stored) {
      yield* succeed(sql, job.id)
      return
    }
    const phone = yield* phoneForCase(sql, caseId)
    const executionId = yield* placeBolnaCall({
      phone,
      caseId,
      idempotencyKey: `call:${caseId}`,
    })
    const won = yield* Effect.tryPromise(
      () => sql`
        update voice_calls
        set execution_id = ${executionId}
        where id = ${voiceCallId}::uuid and execution_id is null
        returning id
      `,
    )
    if (won.length === 0) {
      yield* succeed(sql, job.id)
      return
    }
    const shipmentId = yield* shipmentForCase(sql, caseId)
    yield* accept(sql, {
      orgId: job.orgId,
      dedupKey: mintDedup(`bolna:${voiceCallId}:placed`),
      source: "bolna",
      shipmentId,
      payload: {
        _tag: "CallPlaced",
        dedupKey: mintDedup(`bolna:${voiceCallId}:placed`),
        voiceCallId,
        executionId,
      },
    })
    yield* succeed(sql, job.id)
  })

const poll = (sql: postgres.Sql, job: Claimed) =>
  Effect.gen(function* () {
    if (job.payload._tag !== "PollCall") return
    const executionId = Schema.decodeUnknownSync(ExecutionId)(job.payload.executionId)
    const caseId = job.payload.caseId
    const wait = yield* Effect.tryPromise(
      () => sql<{ deadline_at: Date }[]>`
        select deadline_at from workflow_waits
        where wait_key = ${`bolna:${executionId}`} and status = 'waiting'
      `,
    )
    const deadline = wait[0]?.deadline_at
    const read = yield* readBolnaExecution(executionId).pipe(
      Effect.catch((error) => (tagged(error) === "NotReady" ? Effect.succeed({ _tag: "Pending" as const }) : Effect.fail(error))),
    )
    if ("details" in read && read.details) {
      const details = read.details
      yield* Effect.tryPromise(() => sql`
        update voice_calls
        set provider_details = ${sql.json(details as unknown as postgres.JSONValue)}, synced_at = now(),
            transcript = case when ${read._tag === "Completed"} then ${read._tag === "Completed" ? read.call.transcript : null} else transcript end
        where execution_id = ${executionId}
      `)
    }
    const shipmentId = yield* shipmentForCase(sql, caseId)
    if (read._tag === "Ended") {
      yield* accept(sql, {
        orgId: job.orgId,
        dedupKey: mintDedup(`bolna:${executionId}:timeout`),
        source: "bolna",
        shipmentId,
        payload: {
          _tag: "CallTimedOut",
          dedupKey: mintDedup(`bolna:${executionId}:timeout`),
          executionId,
        },
      })
      yield* succeed(sql, job.id)
      return
    }
    if (read._tag === "Pending") {
      if (deadline && deadline.getTime() < Date.now()) {
        yield* accept(sql, {
          orgId: job.orgId,
          dedupKey: mintDedup(`bolna:${executionId}:timeout`),
          source: "bolna",
          shipmentId,
          payload: {
            _tag: "CallTimedOut",
            dedupKey: mintDedup(`bolna:${executionId}:timeout`),
            executionId,
          },
        })
        yield* succeed(sql, job.id)
        return
      }
      yield* Effect.tryPromise(
        () => sql`
          update workflow_jobs
          set status = 'pending', claimed_by = null, lease_expires_at = null,
              attempt_count = greatest(attempt_count - 1, 0),
              next_run_at = now() + interval '20 seconds'
          where id = ${job.id}::uuid and claimed_by = ${workerId()} and status = 'running'
        `,
      )
      return
    }
    const key = mintDedup(`bolna:${executionId}:completed`)
    yield* accept(sql, {
      orgId: job.orgId,
      dedupKey: key,
      source: "bolna",
      shipmentId,
      payload: { _tag: "CallFinalized", dedupKey: key, ...read.call, executionId },
    })
    yield* succeed(sql, job.id)
  })

const submit = (sql: postgres.Sql, job: Claimed) =>
  Effect.gen(function* () {
    if (job.payload._tag !== "SubmitReattempt") return
    const caseId = job.payload.caseId
    const version = job.payload.version
    const shipmentId = yield* shipmentForCase(sql, caseId)
    const key = mintDedup(`sim:${shipmentId}:reattempt_accepted:${version}`)
    yield* accept(sql, {
      orgId: job.orgId,
      dedupKey: key,
      source: "demo-carrier",
      shipmentId,
      payload: { _tag: "CarrierAccepted", dedupKey: key, caseId },
    })
    yield* succeed(sql, job.id)
  })

const accept = (
  sql: Sql,
  input: { orgId: string; dedupKey: DedupKey; source: string; shipmentId: string; payload: DomainEvent },
) =>
  Effect.tryPromise(
    () => sql`
      select accept_event(
        ${input.orgId}::uuid,
        ${input.dedupKey},
        ${input.source},
        ${sql.json(input.payload as unknown as postgres.JSONValue)},
        ${input.shipmentId}::uuid
      )
    `,
  )

const succeed = (sql: Sql, jobId: string) =>
  Effect.tryPromise(
    () => sql`
      update workflow_jobs
      set status = 'succeeded', resolution = 'done', lease_expires_at = null, updated_at = now()
      where id = ${jobId}::uuid and claimed_by = ${workerId()} and status = 'running'
    `,
  )

const releaseWaiting = (sql: postgres.Sql, jobId: string) =>
  Effect.tryPromise(
    () => sql`
      update workflow_jobs
      set status = 'pending', claimed_by = null, lease_expires_at = null,
          attempt_count = greatest(attempt_count - 1, 0),
          next_run_at = now() + interval '30 seconds'
      where id = ${jobId}::uuid and claimed_by = ${workerId()} and status = 'running'
    `,
  )

const releaseFailed = (sql: postgres.Sql, job: Claimed) =>
  Effect.tryPromise(async () => {
    const rows = await sql<{ attempt_count: number; max_attempts: number }[]>`
      update workflow_jobs
      set status = case when attempt_count >= max_attempts then 'dead' else 'pending' end,
          claimed_by = null,
          lease_expires_at = null,
          next_run_at = now() + interval '15 seconds',
          updated_at = now()
      where id = ${job.id}::uuid and claimed_by = ${workerId()} and status = 'running'
      returning attempt_count, max_attempts
    `
    const row = rows[0]
    if (!row || row.attempt_count < row.max_attempts) return
    const shipmentId = await shipmentIdOf(sql, job)
    if (!shipmentId) return
    await sql`
      select accept_event(
        ${job.orgId}::uuid,
        ${`exhausted:${job.dedupKey}`},
        'worker',
        ${sql.json({
          _tag: "JobExhausted",
          dedupKey: `exhausted:${job.dedupKey}`,
          jobDedupKey: job.dedupKey,
        })},
        ${shipmentId}::uuid
      )
    `
  })

const shipmentIdOf = async (sql: postgres.Sql, job: Claimed): Promise<string | null> => {
  if (job.payload._tag === "ApplyEvent") {
    const rows = await sql<{ shipment_id: string | null }[]>`
      select shipment_id from event_inbox where id = ${job.payload.inboxId}::uuid
    `
    return rows[0]?.shipment_id ?? null
  }
  const rows = await sql<{ shipment_id: string }[]>`
    select shipment_id from recovery_cases where id = ${job.payload.caseId}::uuid
  `
  return rows[0]?.shipment_id ?? null
}

const shipmentForCase = (sql: postgres.Sql, caseId: string) =>
  Effect.tryPromise(async () => {
    const rows = await sql<{ shipment_id: string }[]>`
      select shipment_id from recovery_cases where id = ${caseId}::uuid
    `
    const id = rows[0]?.shipment_id
    if (!id) throw new Error(`case ${caseId} has no shipment`)
    return id
  })

const phoneForCase = (sql: postgres.Sql, caseId: string) =>
  Effect.tryPromise(async () => {
    const rows = await sql<{ phone_ciphertext: string | null }[]>`
      select s.phone_ciphertext
      from recovery_cases c
      join shipments s on s.id = c.shipment_id
      where c.id = ${caseId}::uuid
    `
    const cipher = rows[0]?.phone_ciphertext
    const key = process.env.CREDENTIALS_KEY
    if (cipher && key) return decryptSecret(cipher, key)
    const fallback = process.env.BOLNA_TEST_PHONE
    if (!fallback) throw new MissingCredential({ name: "BOLNA_TEST_PHONE" })
    return fallback
  })

const loadByCase = (sql: postgres.Sql, caseId: string) =>
  Effect.gen(function* () {
    const shipmentId = yield* shipmentForCase(sql, caseId)
    return yield* loadSnapshot(sql, shipmentId)
  })

const applyInbox = (sql: postgres.Sql, job: Claimed) =>
  Effect.tryPromise(() =>
    sql.begin(async (tx) => {
      if (job.payload._tag !== "ApplyEvent") return
      const locked = await tx<{ id: string }[]>`
        select id from workflow_jobs
        where id = ${job.id}::uuid and claimed_by = ${workerId()} and status = 'running'
        for update
      `
      if (locked.length === 0) throw new LeaseLost({ jobId: job.id })
      const inbox = await tx<{ shipment_id: string; payload: unknown; apply_status: string; dedup_key: string }[]>`
        select shipment_id, payload, apply_status, dedup_key
        from event_inbox where id = ${job.payload.inboxId}::uuid
      `
      const row = inbox[0]
      if (!row?.shipment_id) throw new Error("inbox row missing shipment")
      if (row.apply_status === "applied") {
        await markSucceeded(tx, job.id)
        return
      }
      const event = Schema.decodeUnknownSync(DomainEvent)(row.payload)
      const snapshot = await readSnapshot(tx, row.shipment_id)
      const result = reduce(snapshot, event)
      if (result._tag === "Unchanged") {
        await tx`update event_inbox set apply_status = 'applied' where id = ${job.payload.inboxId}::uuid`
        await markSucceeded(tx, job.id)
        return
      }
      if (result._tag === "RejectEvent") {
        await tx`update event_inbox set apply_status = 'rejected' where id = ${job.payload.inboxId}::uuid`
        await markSucceeded(tx, job.id)
        return
      }
      await persist(tx, snapshot, result, row.dedup_key)
      await tx`update event_inbox set apply_status = 'applied' where id = ${job.payload.inboxId}::uuid`
      await tx`
        update shipments set current_carrier_status = ${result.shipmentStatus}
        where id = ${row.shipment_id}::uuid
      `
      await markSucceeded(tx, job.id)
    }),
  )

const markSucceeded = (tx: postgres.TransactionSql, jobId: string) =>
  tx`
    update workflow_jobs
    set status = 'succeeded', resolution = 'done', lease_expires_at = null, updated_at = now()
    where id = ${jobId}::uuid and claimed_by = ${workerId()}
  `

const persist = async (
  tx: postgres.TransactionSql,
  snapshot: CaseSnapshot,
  result: Extract<ReduceResult, { _tag: "Changed" }>,
  eventKey: string,
) => {
  let caseId = snapshot._tag === "Open" ? snapshot.caseId : ""
  let voiceId = snapshot._tag === "Open" ? snapshot.voiceCallId : null
  const orgId = DemoOrgId
  for (const write of result.writes) {
    caseId = await applyWrite(tx, write, { orgId, caseId, voiceId, shipmentId: snapshot.shipment.id, eventKey })
    if (write._tag === "InsertVoicePlacing") {
      const rows = await tx<{ id: string }[]>`
        select id from voice_calls where org_id = ${orgId}::uuid and idempotency_key = ${write.idempotencyKey}
      `
      voiceId = rows[0]?.id ?? voiceId
    }
  }
}

const applyWrite = async (
  tx: postgres.TransactionSql,
  write: RowWrite,
  ctx: { orgId: string; caseId: string; voiceId: string | null; shipmentId: string; eventKey: string },
): Promise<string> => {
  switch (write._tag) {
    case "InsertCase": {
      const rows = await tx<{ id: string }[]>`
        insert into recovery_cases (org_id, shipment_id, phase, review_reason, version, open)
        values (
          ${ctx.orgId}::uuid,
          ${ctx.shipmentId}::uuid,
          ${phaseLabel(write.phase)},
          ${reviewReasonOf(write.phase)},
          1,
          ${!isClosed(write.phase)}
        )
        returning id
      `
      return rows[0]?.id ?? ctx.caseId
    }
    case "UpdateCase": {
      const rows = await tx<{ id: string }[]>`
        update recovery_cases
        set phase = ${phaseLabel(write.phase)},
            review_reason = ${reviewReasonOf(write.phase)},
            version = version + 1,
            open = ${!isClosed(write.phase)},
            updated_at = now()
        where id = ${ctx.caseId}::uuid and version = ${write.expectedVersion}
        returning id
      `
      if (rows.length === 0) throw new Error("case version conflict")
      return ctx.caseId
    }
    case "InsertShipmentEvent":
      await tx`
        insert into shipment_events (org_id, shipment_id, dedup_key, kind)
        values (${ctx.orgId}::uuid, ${ctx.shipmentId}::uuid, ${write.dedupKey}, 'carrier')
        on conflict (org_id, dedup_key) do nothing
      `
      return ctx.caseId
    case "InsertRun":
      await tx`
        insert into agent_runs (org_id, case_id, idempotency_key, status)
        values (${ctx.orgId}::uuid, ${ctx.caseId}::uuid, ${write.idempotencyKey}, 'running')
        on conflict (org_id, idempotency_key) do nothing
      `
      return ctx.caseId
    case "InsertDecision":
      await tx`
        insert into agent_decisions (org_id, case_id, proposal_tag, policy_tag, evidence_ids, reason)
        values (
          ${ctx.orgId}::uuid, ${ctx.caseId}::uuid, ${write.proposalTag}, ${write.policyTag},
          ${tx.json(write.evidenceIds)}, ${write.reason}
        )
      `
      return ctx.caseId
    case "InsertVoicePlacing":
      await tx`
        insert into voice_calls (org_id, case_id, idempotency_key, status)
        values (${ctx.orgId}::uuid, ${ctx.caseId}::uuid, ${write.idempotencyKey}, 'placing')
        on conflict (org_id, idempotency_key) do nothing
      `
      return ctx.caseId
    case "MarkVoiceInFlight":
      await tx`
        update voice_calls set status = 'in_flight', execution_id = ${write.executionId}
        where id = ${ctx.voiceId}::uuid
      `
      return ctx.caseId
    case "MarkVoiceCompleted":
      await tx`
        update voice_calls
        set status = 'completed', duration_ms = ${write.durationMs}, cost_paise = ${write.costPaise},
            transcript = ${write.transcript}, extraction = ${tx.json(write.extractions)}
        where case_id = ${ctx.caseId}::uuid
      `
      return ctx.caseId
    case "InsertApproval":
      await tx`
        insert into action_approvals (org_id, case_id, status, idempotency_key)
        values (${ctx.orgId}::uuid, ${ctx.caseId}::uuid, ${write.status}, ${write.idempotencyKey})
        on conflict (org_id, idempotency_key) do nothing
      `
      return ctx.caseId
    case "InsertReceipt":
      await tx`
        insert into action_receipts (org_id, case_id, idempotency_key)
        values (${ctx.orgId}::uuid, ${ctx.caseId}::uuid, ${write.idempotencyKey})
        on conflict (org_id, idempotency_key) do nothing
      `
      return ctx.caseId
    case "ArmWait":
      await tx`
        insert into workflow_waits (org_id, case_id, wait_key, status, deadline_at)
        values (${ctx.orgId}::uuid, ${ctx.caseId}::uuid, ${write.waitKey}, 'waiting', now() + interval '15 minutes')
        on conflict (org_id, wait_key) do nothing
      `
      return ctx.caseId
    case "SatisfyWait":
      await tx`
        update workflow_waits set status = 'satisfied'
        where org_id = ${ctx.orgId}::uuid and wait_key = ${write.waitKey}
      `
      return ctx.caseId
    case "InsertMemory":
      await tx`
        insert into case_memory (org_id, case_id, dedup_key, availability, reattempt_day)
        values (
          ${ctx.orgId}::uuid, ${ctx.caseId}::uuid, ${write.dedupKey},
          ${write.fact.availability}, ${write.fact.reattemptDay}
        )
        on conflict (org_id, dedup_key) do nothing
      `
      return ctx.caseId
    case "InsertOutcome":
      await tx`
        insert into outcomes (org_id, case_id, source, result)
        values (${ctx.orgId}::uuid, ${ctx.caseId}::uuid, ${write.source}, ${write.result})
        on conflict (case_id) do nothing
      `
      return ctx.caseId
    case "InsertOutbox":
      await tx`
        insert into event_outbox (org_id, case_id, dedup_key, status)
        values (${ctx.orgId}::uuid, ${ctx.caseId || null}::uuid, ${write.dedupKey}, 'pending')
        on conflict (org_id, dedup_key) do nothing
      `
      return ctx.caseId
    case "EnqueuePlan":
      await enqueue(tx, ctx.orgId, `plan:${ctx.caseId}`, { _tag: "Plan", caseId: ctx.caseId }, "now")
      return ctx.caseId
    case "EnqueuePlaceCall": {
      const voice = await tx<{ id: string }[]>`
        select id from voice_calls where case_id = ${ctx.caseId}::uuid order by id desc limit 1
      `
      const voiceCallId = voice[0]?.id
      if (!voiceCallId) throw new Error("place call without a voice row")
      await enqueue(tx, ctx.orgId, `place:${ctx.caseId}`, { _tag: "PlaceCall", caseId: ctx.caseId, voiceCallId }, "now")
      return ctx.caseId
    }
    case "EnqueuePoll":
      await enqueue(
        tx,
        ctx.orgId,
        `poll:${write.executionId}`,
        { _tag: "PollCall", caseId: ctx.caseId, executionId: write.executionId },
        "20s",
      )
      return ctx.caseId
    case "EnqueueSubmit":
      await enqueue(
        tx,
        ctx.orgId,
        `submit:${ctx.caseId}:${write.version}`,
        { _tag: "SubmitReattempt", caseId: ctx.caseId, version: write.version },
        "now",
      )
      return ctx.caseId
    default: {
      const _exhaustive: never = write
      return _exhaustive
    }
  }
}

const enqueue = (
  tx: postgres.TransactionSql,
  orgId: string,
  dedupKey: string,
  payload: JobPayload,
  when: "now" | "20s",
) => {
  const nextRun = when === "now" ? tx`now()` : tx`now() + interval '20 seconds'`
  return tx`
    insert into workflow_jobs (org_id, dedup_key, status, payload, next_run_at)
    values (${orgId}::uuid, ${dedupKey}, 'pending', ${tx.json(payload)}, ${nextRun})
    on conflict (org_id, dedup_key) do nothing
  `
}

const readSnapshot = async (tx: postgres.TransactionSql, shipmentId: string): Promise<CaseSnapshot> => {
  const rows = await tx<
    {
      id: string
      ref: string
      contact_policy: "ok_to_call" | "opted_out"
      cod_amount_paise: number
      current_carrier_status: string
      agent_mode: "running" | "paused"
      case_id: string | null
      phase: string | null
      review_reason: string | null
      version: number | null
      voice_id: string | null
      execution_id: string | null
      connector_id: string | null
      permissions: { simulatedReattempt?: string }
    }[]
  >`
    select s.id, s.ref, s.contact_policy, s.cod_amount_paise, s.current_carrier_status,
           o.agent_mode, c.id as case_id, c.phase, c.review_reason, c.version,
           v.id as voice_id, v.execution_id, pc.connector_id, pc.permissions
    from shipments s
    join organizations o on o.id = s.org_id
    left join recovery_cases c on c.shipment_id = s.id and c.open
    left join voice_calls v on v.case_id = c.id
    left join provider_connections pc
      on pc.org_id = s.org_id and pc.kind = 'logistics' and pc.active
    where s.id = ${shipmentId}::uuid
  `
  const row = rows[0]
  if (!row) throw new Error(`shipment ${shipmentId} missing`)
  const evidence = await tx<{ dedup_key: string }[]>`
    select dedup_key from shipment_events where shipment_id = ${shipmentId}::uuid
  `
  const applied = await tx<{ dedup_key: string }[]>`
    select dedup_key from event_inbox
    where shipment_id = ${shipmentId}::uuid and apply_status = 'applied'
  `
  const logistics: LogisticsMode =
    row.connector_id === "shiprocket"
      ? { _tag: "shiprocket", submit: "no" }
      : { _tag: "demo-carrier", submit: "simulated" }
  const permission = permissionOf(row.permissions)
  const shipment = {
    id: row.id,
    ref: row.ref,
    contact: row.contact_policy,
    carrierStatus: carrierStatusOf(row.current_carrier_status),
    codAmountPaise: row.cod_amount_paise,
    evidenceIds: evidence.map((item) => item.dedup_key),
  }
  if (!row.case_id || !row.phase || row.version === null) {
    return {
      _tag: "NoCase",
      shipment,
      agentMode: row.agent_mode,
      logistics,
      permission,
      todayIst: todayIst(),
    }
  }
  return {
    _tag: "Open",
    caseId: row.case_id,
    version: row.version,
    phase: phaseFrom(row.phase, row.review_reason),
    shipment,
    memory: { availability: "unknown", reattemptDay: null },
    voiceCallId: row.voice_id,
    executionId: row.execution_id,
    appliedDedupKeys: new Set(applied.map((item) => mintDedup(item.dedup_key))),
    agentMode: row.agent_mode,
    logistics,
    permission,
    todayIst: todayIst(),
  }
}

const loadSnapshot = (sql: postgres.Sql, shipmentId: string) =>
  Effect.tryPromise(() => sql.begin((tx) => readSnapshot(tx, shipmentId)))

const carrierStatusOf = (value: string): CarrierStatus => {
  switch (value) {
    case "created":
    case "ndr":
    case "reattempt_submitted":
    case "delivered":
    case "returned":
      return value
    default:
      throw new Error(`unknown carrier status ${value}`)
  }
}

const reviewReason = (value: string | null): ReviewReason => {
  switch (value) {
    case "model_invalid":
    case "call_unclear":
    case "call_timeout":
    case "call_failed":
    case "permission_denied":
    case "capability_missing":
    case "date_out_of_window":
    case "job_exhausted":
    case "submit_failed":
      return value
    default:
      return "model_invalid"
  }
}

const unresolvedReason = (value: string | null): UnresolvedReason => {
  switch (value) {
    case "opted_out":
    case "customer_denied":
    case "approval_denied":
      return value
    default:
      return "opted_out"
  }
}

const permissionOf = (permissions: { simulatedReattempt?: string } | null): "auto" | "require_human" | "deny" => {
  const value = permissions?.simulatedReattempt
  if (value === "require_human" || value === "deny") return value
  return "auto"
}

const phaseFrom = (phase: string, reason: string | null): OpenPhase => {
  switch (phase) {
    case "Detected":
    case "Evaluating":
    case "AwaitingCustomer":
    case "BolnaCall":
    case "AwaitingApproval":
    case "ActionSubmitted":
    case "AwaitingCarrierOutcome":
    case "Delivered":
    case "Returned":
      return { _tag: phase }
    case "HumanReview":
      return { _tag: "HumanReview", reason: reviewReason(reason) }
    case "Unresolved":
      return { _tag: "Unresolved", reason: unresolvedReason(reason) }
    default:
      throw new Error(`unknown phase ${phase}`)
  }
}

export const wakePoll = (sql: postgres.Sql, executionId: string) =>
  sql`
    update workflow_jobs
    set next_run_at = now(), status = 'pending', attempt_count = 0,
        claimed_by = null, lease_expires_at = null, resolution = null
    where dedup_key = ${`poll:${executionId}`} and status in ('pending', 'succeeded')
  `

export const WorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const harness = yield* Harness
    yield* Effect.forkScoped(harness.run)
  }),
).pipe(Layer.provide(Harness.layer))
