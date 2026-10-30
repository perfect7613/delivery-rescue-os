import { NextResponse } from "next/server"
import { db } from "../../../../lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = process.env.BOLNA_WEBHOOK_SECRET
  if (secret && request.headers.get("x-bolna-secret") !== secret) {
    return new NextResponse(null, { status: 401 })
  }
  const body: unknown = await request.json()
  if (typeof body !== "object" || body === null) return NextResponse.json({ ok: true })
  const record = body as { status?: unknown; id?: unknown; execution_id?: unknown }
  if (record.status !== "completed") return NextResponse.json({ ok: true })
  const executionId = typeof record.execution_id === "string" ? record.execution_id : record.id
  if (typeof executionId !== "string" || executionId.length === 0) return NextResponse.json({ ok: true })
  await db()`
    update workflow_jobs
    set next_run_at = now()
    where dedup_key = ${`poll:${executionId}`} and status = 'pending'
  `
  return NextResponse.json({ ok: true })
}
