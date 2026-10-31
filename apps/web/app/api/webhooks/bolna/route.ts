import { wakePoll } from "@rescue/harness"
import { NextResponse } from "next/server"
import { db } from "../../../../lib/db"
import { wakeWorker } from "../../../../lib/wake"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  const secret = process.env.BOLNA_WEBHOOK_SECRET
  if (secret && request.headers.get("x-bolna-secret") !== secret) {
    return new NextResponse(null, { status: 401 })
  }
  const body: unknown = await request.json()
  if (typeof body !== "object" || body === null) return NextResponse.json({ ok: true })
  const record = body as { status?: unknown; id?: unknown; execution_id?: unknown }
  if (typeof record.status !== "string" || !["completed", "busy", "no-answer", "failed", "canceled", "stopped", "error", "balance-low"].includes(record.status)) {
    return NextResponse.json({ ok: true })
  }
  const executionId = typeof record.execution_id === "string" ? record.execution_id : record.id
  if (typeof executionId !== "string" || executionId.length === 0) return NextResponse.json({ ok: true })
  await wakePoll(db(), executionId)
  wakeWorker()
  return NextResponse.json({ ok: true })
}
