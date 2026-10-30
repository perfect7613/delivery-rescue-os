import { DemoOrgId } from "@rescue/shared"
import { NextResponse } from "next/server"
import { db } from "../../../lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const form = await request.formData()
  const mode = form.get("mode") === "paused" ? "paused" : "running"
  await db()`
    update organizations set agent_mode = ${mode}
    where id = ${DemoOrgId}::uuid
  `
  return NextResponse.redirect(new URL("/agent", request.url), 303)
}
