import assert from "node:assert/strict"
import test from "node:test"
import { mintDedup } from "@rescue/shared"
import { reduce, type CaseSnapshot } from "./reduce.js"

const today = "2026-10-31"

const noCase = (contact: "ok_to_call" | "opted_out", carrier: "created" | "delivered" = "created"): CaseSnapshot => ({
  _tag: "NoCase",
  shipment: {
    id: "ship-1",
    ref: contact === "opted_out" ? "DEMOOPT" : "DEMO1499",
    contact,
    carrierStatus: carrier,
    codAmountPaise: 149900,
    evidenceIds: [],
  },
  agentMode: "running",
  logistics: { _tag: "demo-carrier", submit: "simulated" },
  permission: "auto",
  todayIst: today,
})

test("cod ndr asks for a plan and does not place a call", () => {
  const result = reduce(noCase("ok_to_call"), {
    _tag: "NdrCreated",
    dedupKey: mintDedup("sim:DEMO1499:ndr_created"),
    shipmentId: "ship-1",
  })
  assert.equal(result._tag, "Changed")
  if (result._tag !== "Changed") return
  assert.equal(result.shipmentStatus, "ndr")
  assert.ok(result.writes.some((write) => write._tag === "InsertCase" && write.phase._tag === "Evaluating"))
  assert.ok(result.writes.some((write) => write._tag === "EnqueuePlan"))
  assert.equal(result.writes.some((write) => write._tag === "EnqueuePlaceCall"), false)
})

test("opted out case emits no job", () => {
  const result = reduce(noCase("opted_out"), {
    _tag: "NdrCreated",
    dedupKey: mintDedup("sim:DEMOOPT:ndr_created"),
    shipmentId: "ship-1",
  })
  assert.equal(result._tag, "Changed")
  if (result._tag !== "Changed") return
  assert.ok(result.writes.some((write) => write._tag === "InsertCase" && write.phase._tag === "Unresolved"))
  assert.equal(
    result.writes.some((write) => write._tag === "EnqueuePlan" || write._tag === "EnqueuePlaceCall"),
    false,
  )
})

test("a second apply of the same event is unchanged", () => {
  const key = mintDedup("sim:DEMO1499:ndr_created")
  const open: CaseSnapshot = {
    _tag: "Open",
    caseId: "case-1",
    version: 1,
    phase: { _tag: "Evaluating" },
    shipment: noCase("ok_to_call").shipment,
    memory: { availability: "unknown", reattemptDay: null },
    voiceCallId: null,
    executionId: null,
    appliedDedupKeys: new Set([key]),
    agentMode: "running",
    logistics: { _tag: "demo-carrier", submit: "simulated" },
    permission: "auto",
    todayIst: today,
  }
  const result = reduce(open, { _tag: "NdrCreated", dedupKey: key, shipmentId: "ship-1" })
  assert.equal(result._tag, "Unchanged")
})
