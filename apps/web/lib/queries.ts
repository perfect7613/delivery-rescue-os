import { db, databaseUrl } from "./db"

export type WorkerLamp = { workerId: string; status: string; lastSeenAt: string; ageSeconds: number } | null

export const connected = () => databaseUrl() !== null

const age = (value: Date | string): number => Math.round((Date.now() - new Date(value).getTime()) / 1000)

export async function workerLamp(): Promise<WorkerLamp> {
  if (!connected()) return null
  const rows = await db()`
    select worker_id, status, last_seen_at from worker_status
    order by last_seen_at desc limit 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    workerId: String(row.worker_id),
    status: String(row.status),
    lastSeenAt: new Date(row.last_seen_at as string).toISOString(),
    ageSeconds: age(row.last_seen_at as string),
  }
}

export async function overview() {
  const sql = db()
  const phases = await sql<{ phase: string; count: number }[]>`
    select phase, count(*)::int as count from recovery_cases group by phase order by phase
  `
  const calls = await sql<{ count: number }[]>`select count(*)::int as count from voice_calls`
  return { phases, calls: calls[0]?.count ?? 0 }
}

export async function queue() {
  return db()`
    select c.id, s.id as shipment_id, c.phase, c.review_reason, c.updated_at, s.ref, s.cod_amount_paise, s.current_carrier_status
    from recovery_cases c
    join shipments s on s.id = c.shipment_id
    where c.open
    order by c.updated_at desc
  `
}

export async function shipment(id: string) {
  const sql = db()
  const rows = await sql`select * from shipments_public where id = ${id}::uuid`
  const events = await sql`
    select dedup_key, kind, created_at from shipment_events where shipment_id = ${id}::uuid order by created_at
  `
  const decisions = await sql`
    select d.proposal_tag, d.policy_tag, d.reason, d.evidence_ids, d.created_at
    from agent_decisions d
    join recovery_cases c on c.id = d.case_id
    where c.shipment_id = ${id}::uuid
    order by d.created_at
  `
  const calls = await sql`
    select v.status, v.execution_id, v.duration_ms, v.cost_paise, v.transcript, v.extraction
    from voice_calls v
    join recovery_cases c on c.id = v.case_id
    where c.shipment_id = ${id}::uuid
  `
  const outcomes = await sql`
    select o.source, o.result from outcomes o
    join recovery_cases c on c.id = o.case_id
    where c.shipment_id = ${id}::uuid
  `
  return { shipment: rows[0] ?? null, events, decisions, calls, outcomes }
}

export async function connections() {
  return db()`
    select connector_id, kind, availability, active
    from provider_connections
    where org_id = '00000000-0000-4000-8000-000000000001'
    order by kind, connector_id
  `
}

export async function approvals() {
  return db()`
    select a.id, a.status, a.created_at, s.ref
    from action_approvals a
    join recovery_cases c on c.id = a.case_id
    join shipments s on s.id = c.shipment_id
    where a.status = 'pending'
    order by a.created_at
  `
}

export async function openCaseCount() {
  const rows = await db()`select count(*)::int as count from recovery_cases where open`
  return Number(rows[0]?.count ?? 0)
}

export async function throughput() {
  const rows = await db()`
    with days as (
      select generate_series((current_date - 7), current_date, interval '1 day')::date as day
    )
    select
      to_char(days.day, 'Mon DD') as day,
      coalesce((
        select count(*)::int from shipment_events e where e.created_at::date = days.day
      ), 0) as opened,
      coalesce((
        select count(*)::int from outcomes o where o.created_at::date = days.day
      ), 0) as completed
    from days
    order by days.day
  `
  return rows.map((row) => ({
    day: String(row.day),
    opened: Number(row.opened),
    completed: Number(row.completed),
  }))
}

export async function recentActivity() {
  return db()`
    select d.created_at, d.proposal_tag, d.policy_tag, s.ref
    from agent_decisions d
    join recovery_cases c on c.id = d.case_id
    join shipments s on s.id = c.shipment_id
    order by d.created_at desc
    limit 6
  `
}

export async function agentMode() {
  const rows = await db()`
    select agent_mode from organizations where id = '00000000-0000-4000-8000-000000000001'
  `
  return String(rows[0]?.agent_mode ?? "running")
}
