import assert from "node:assert/strict"
import test, { type TestContext } from "node:test"
import { Effect } from "effect"
import { readBolnaExecution, safeRecordingUrl } from "./index.js"

test("recordings only accept credential-free HTTPS URLs", () => {
  assert.equal(safeRecordingUrl("javascript:alert(1)"), null)
  assert.equal(safeRecordingUrl("http://example.com/call.wav"), null)
  assert.equal(safeRecordingUrl("https://user:password@example.com/call.wav"), null)
  assert.equal(safeRecordingUrl("https://example.com/call.wav"), "https://example.com/call.wav")
})

async function readFixture(t: TestContext, body: unknown) {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(body), { status: 200 }))
  const previous = process.env.BOLNA_API_KEY
  process.env.BOLNA_API_KEY = "test-only"
  try {
    return await Effect.runPromise(readBolnaExecution("test-execution"))
  } finally {
    if (previous == null) delete process.env.BOLNA_API_KEY
    else process.env.BOLNA_API_KEY = previous
  }
}

test("completed calls retain selected metadata without telephony phone numbers", async (t) => {
  const read = await readFixture(t, {
    status: "completed", summary: "Customer asked for review.", total_cost: "1.46",
    transcript: "user: Tomorrow does not work for me.", conversation_duration: 12,
    termination_reason: "user_hung_up", error_message: null,
    telephony_data: { recording_url: "https://example.com/call.wav", to_number: "+910000000000" },
    extracted_data: {}, cost_breakdown: { network: 1 },
  })
  assert.equal(read._tag, "Completed")
  if (read._tag !== "Completed") return
  assert.equal(read.call.durationMs, 12000)
  assert.equal(read.call.costPaise, 146)
  assert.equal(read.call.extractions._tag, "Unclear")
  assert.equal(read.details.summary, "Customer asked for review.")
  assert.equal(read.details.recording_url, "https://example.com/call.wav")
  assert.equal(JSON.stringify(read.details).includes("+910000000000"), false)
})

test("date mentions without explicit extracted consent never authorize a reattempt", async (t) => {
  const read = await readFixture(t, {
    status: "completed", transcript: "user: not tomorrow",
    extracted_data: { reattempt_date: "2026-11-01" },
  })
  if (read._tag !== "Completed") return assert.fail("Expected completed call")
  assert.equal(read.call.extractions._tag, "Unclear")
})

test("confirmed extraction with a review reason stays unclear", async (t) => {
  const read = await readFixture(t, {
    status: "completed", extracted_data: { customer_intent: "confirmed", reattempt_date: "2026-11-01", review_reason: "address_change" },
  })
  if (read._tag !== "Completed") return assert.fail("Expected completed call")
  assert.equal(read.call.extractions._tag, "Unclear")
})

test("confirmed extraction without an exception preserves the confirmed day", async (t) => {
  const read = await readFixture(t, {
    status: "completed", extracted_data: { customer_intent: "confirmed", reattempt_date: "2026-11-01", review_reason: "none" },
  })
  if (read._tag !== "Completed") return assert.fail("Expected completed call")
  assert.deepEqual(read.call.extractions, { _tag: "Confirmed", day: "2026-11-01" })
})

test("terminal unsuccessful calls retain provider status and reason", async (t) => {
  const read = await readFixture(t, { status: "no-answer", termination_reason: "no_answer", extracted_data: null })
  assert.equal(read._tag, "Ended")
  assert.equal(read.details?.termination_reason, "no_answer")
})

test("in-flight calls expose provider progress without finalizing", async (t) => {
  const read = await readFixture(t, { status: "ringing", telephony_data: null })
  assert.equal(read._tag, "Pending")
  assert.equal(read.details?.status, "ringing")
})
