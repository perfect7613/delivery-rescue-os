import { processFor } from "@rescue/harness"
import { Effect } from "effect"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const authorized = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse(null, { status: 401 })
  await Effect.runPromise(processFor(45_000))
  return NextResponse.json({ ok: true })
}
