import { DemoOrgId } from "@rescue/shared"
import { encryptSecret } from "@rescue/shared/secrets"
import { NextResponse } from "next/server"
import { db } from "../../../../lib/db"

export const dynamic = "force-dynamic"

const formValue = (form: FormData, name: string): string => {
  const value = form.get(name)
  return typeof value === "string" ? value : ""
}

export async function POST(request: Request) {
  if (process.env.DEMO_SIMULATOR === "0") return new NextResponse(null, { status: 404 })
  const form = await request.formData()
  const fixture = formValue(form, "fixture")
  const sql = db()
  if (fixture === "advance") {
    await sql`select advance_demo(${DemoOrgId}::uuid, ${formValue(form, "ref")}, 'delivered')`
    return NextResponse.redirect(new URL("/queue", request.url), 303)
  }
  const ref = fixture === "opted_out" ? "DEMOOPT" : "DEMO1499"
  const contact = fixture === "opted_out" ? "opted_out" : "ok_to_call"
  const phone = process.env.BOLNA_TEST_PHONE
  const key = process.env.CREDENTIALS_KEY
  const cipher = phone && key ? encryptSecret(phone, key) : null
  const mask = phone ? `${phone.slice(0, 3)}••••${phone.slice(-2)}` : null
  await sql`
    select seed_demo_case(
      ${DemoOrgId}::uuid,
      ${ref},
      ${contact},
      'created',
      149900,
      ${cipher},
      ${mask}
    )
  `
  return NextResponse.redirect(new URL("/queue", request.url), 303)
}
