import type { DedupKey, DomainEvent, Extraction, ModelProposal } from "@rescue/shared"

export type CarrierStatus = "created" | "ndr" | "reattempt_submitted" | "delivered" | "returned"
export type ContactPolicy = "ok_to_call" | "opted_out"
export type ReviewReason =
  | "model_invalid"
  | "call_unclear"
  | "call_timeout"
  | "call_failed"
  | "permission_denied"
  | "capability_missing"
  | "date_out_of_window"
  | "job_exhausted"
  | "submit_failed"
export type UnresolvedReason = "opted_out" | "customer_denied" | "approval_denied"

export type OpenPhase =
  | { _tag: "Detected" }
  | { _tag: "Evaluating" }
  | { _tag: "AwaitingCustomer" }
  | { _tag: "BolnaCall" }
  | { _tag: "AwaitingApproval" }
  | { _tag: "ActionSubmitted" }
  | { _tag: "AwaitingCarrierOutcome" }
  | { _tag: "HumanReview"; reason: ReviewReason }
  | { _tag: "Unresolved"; reason: UnresolvedReason }
  | { _tag: "Delivered" }
  | { _tag: "Returned" }

export type ShipmentView = {
  id: string
  ref: string
  contact: ContactPolicy
  carrierStatus: CarrierStatus
  codAmountPaise: number
  evidenceIds: ReadonlyArray<string>
}

export type LogisticsMode =
  | { _tag: "demo-carrier"; submit: "simulated" }
  | { _tag: "shiprocket"; submit: "no" }

export type Memory = {
  availability: "unknown" | "confirmed" | "denied"
  reattemptDay: string | null
}

export type CaseSnapshot =
  | {
      _tag: "NoCase"
      shipment: ShipmentView
      agentMode: "running" | "paused"
      logistics: LogisticsMode
      permission: "auto" | "require_human" | "deny"
      todayIst: string
    }
  | {
      _tag: "Open"
      caseId: string
      version: number
      phase: OpenPhase
      shipment: ShipmentView
      memory: Memory
      voiceCallId: string | null
      executionId: string | null
      appliedDedupKeys: ReadonlySet<DedupKey>
      agentMode: "running" | "paused"
      logistics: LogisticsMode
      permission: "auto" | "require_human" | "deny"
      todayIst: string
    }

export type RowWrite =
  | { _tag: "InsertCase"; phase: OpenPhase }
  | { _tag: "UpdateCase"; phase: OpenPhase; expectedVersion: number }
  | { _tag: "InsertShipmentEvent"; dedupKey: DedupKey }
  | { _tag: "InsertRun"; idempotencyKey: string }
  | { _tag: "InsertDecision"; proposalTag: string; policyTag: "accepted" | "rejected"; evidenceIds: ReadonlyArray<string>; reason: string }
  | { _tag: "InsertVoicePlacing"; idempotencyKey: string }
  | { _tag: "MarkVoiceInFlight"; executionId: string }
  | { _tag: "MarkVoiceCompleted"; durationMs: number; costPaise: number; transcript: string; extractions: Extraction }
  | { _tag: "InsertApproval"; status: "pending" | "policy_granted"; idempotencyKey: string }
  | { _tag: "InsertReceipt"; idempotencyKey: string }
  | { _tag: "ArmWait"; waitKey: string }
  | { _tag: "SatisfyWait"; waitKey: string }
  | { _tag: "InsertMemory"; dedupKey: DedupKey; fact: Memory }
  | { _tag: "InsertOutcome"; source: "simulated" | "live"; result: "delivered" | "returned" }
  | { _tag: "InsertOutbox"; dedupKey: DedupKey }
  | { _tag: "EnqueuePlan" }
  | { _tag: "EnqueuePlaceCall" }
  | { _tag: "EnqueuePoll"; executionId: string }
  | { _tag: "EnqueueSubmit"; version: number }

export type ReduceResult =
  | { _tag: "Unchanged" }
  | { _tag: "RejectEvent" }
  | { _tag: "Changed"; shipmentStatus: CarrierStatus; writes: ReadonlyArray<RowWrite> }

const changed = (shipmentStatus: CarrierStatus, writes: ReadonlyArray<RowWrite>): ReduceResult => ({
  _tag: "Changed",
  shipmentStatus,
  writes,
})

const addDays = (iso: string, days: number): string => {
  const [year, month, day] = iso.split("-").map((part) => Number(part))
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const inWindow = (day: string, today: string): boolean => day >= today && day <= addDays(today, 3)

const evidenceOk = (ids: ReadonlyArray<string>, known: ReadonlyArray<string>): boolean =>
  ids.length > 0 && ids.every((id) => known.includes(id))

export const phaseLabel = (phase: OpenPhase): string => phase._tag

export const reviewReasonOf = (phase: OpenPhase): string | null =>
  phase._tag === "HumanReview" || phase._tag === "Unresolved" ? phase.reason : null

export const isClosed = (phase: OpenPhase): boolean =>
  phase._tag === "Delivered" || phase._tag === "Returned" || phase._tag === "Unresolved"

export function reduce(snapshot: CaseSnapshot, event: DomainEvent): ReduceResult {
  if (snapshot._tag === "Open" && snapshot.appliedDedupKeys.has(event.dedupKey)) {
    return { _tag: "Unchanged" }
  }

  switch (event._tag) {
    case "NdrCreated":
      return onNdr(snapshot, event.dedupKey)
    case "AgentResumed":
      return onResume(snapshot, event.dedupKey)
    case "ModelProposal":
      return onProposal(snapshot, event)
    case "ModelRejected":
      return reviewing(snapshot, "model_invalid", event.dedupKey)
    case "CallPlaced":
      return onPlaced(snapshot, event)
    case "CallFinalized":
      return onFinalized(snapshot, event)
    case "CallTimedOut":
      return reviewing(snapshot, "call_timeout", event.dedupKey)
    case "ApprovalDecided":
      return onApproval(snapshot, event)
    case "CarrierAccepted":
      return onAccepted(snapshot, event.dedupKey)
    case "CarrierAdvanced":
      return onAdvanced(snapshot, event)
    case "JobExhausted":
      return reviewing(snapshot, "job_exhausted", event.dedupKey)
    default: {
      const _exhaustive: never = event
      return _exhaustive
    }
  }
}

function onNdr(snapshot: CaseSnapshot, dedupKey: DedupKey): ReduceResult {
  if (snapshot._tag !== "NoCase") return { _tag: "RejectEvent" }
  const base: RowWrite[] = [{ _tag: "InsertShipmentEvent", dedupKey }, { _tag: "InsertOutbox", dedupKey }]
  if (snapshot.shipment.carrierStatus === "delivered") {
    return changed("delivered", [
      { _tag: "InsertCase", phase: { _tag: "Delivered" } },
      { _tag: "InsertOutcome", source: snapshot.logistics._tag === "demo-carrier" ? "simulated" : "live", result: "delivered" },
      ...base,
    ])
  }
  if (snapshot.shipment.contact === "opted_out") {
    return changed("ndr", [
      { _tag: "InsertCase", phase: { _tag: "Unresolved", reason: "opted_out" } },
      ...base,
    ])
  }
  if (snapshot.agentMode === "paused") {
    return changed("ndr", [{ _tag: "InsertCase", phase: { _tag: "Detected" } }, ...base])
  }
  return changed("ndr", [
    { _tag: "InsertCase", phase: { _tag: "Evaluating" } },
    { _tag: "InsertRun", idempotencyKey: `plan:${snapshot.shipment.id}` },
    { _tag: "EnqueuePlan" },
    ...base,
  ])
}

function onResume(snapshot: CaseSnapshot, dedupKey: DedupKey): ReduceResult {
  if (snapshot._tag !== "Open" || snapshot.phase._tag !== "Detected" || snapshot.agentMode !== "running") {
    return { _tag: "RejectEvent" }
  }
  if (snapshot.shipment.contact !== "ok_to_call") return { _tag: "RejectEvent" }
  return changed(snapshot.shipment.carrierStatus, [
    { _tag: "UpdateCase", phase: { _tag: "Evaluating" }, expectedVersion: snapshot.version },
    { _tag: "InsertRun", idempotencyKey: `plan:${snapshot.caseId}:resume` },
    { _tag: "EnqueuePlan" },
    { _tag: "InsertOutbox", dedupKey },
  ])
}

function onProposal(
  snapshot: CaseSnapshot,
  event: Extract<DomainEvent, { _tag: "ModelProposal" }>,
): ReduceResult {
  if (snapshot._tag !== "Open" || snapshot.phase._tag !== "Evaluating") return { _tag: "RejectEvent" }
  const proposal: ModelProposal = event.proposal
  const cites = evidenceOk(proposal.evidenceIds, snapshot.shipment.evidenceIds)
  if (proposal._tag !== "ConfirmAvailability" || !cites || snapshot.shipment.contact !== "ok_to_call") {
    return changed(snapshot.shipment.carrierStatus, [
      { _tag: "UpdateCase", phase: { _tag: "HumanReview", reason: "model_invalid" }, expectedVersion: snapshot.version },
      {
        _tag: "InsertDecision",
        proposalTag: proposal._tag,
        policyTag: "rejected",
        evidenceIds: proposal.evidenceIds,
        reason: proposal.reason,
      },
      { _tag: "InsertOutbox", dedupKey: event.dedupKey },
    ])
  }
  return changed(snapshot.shipment.carrierStatus, [
    { _tag: "UpdateCase", phase: { _tag: "AwaitingCustomer" }, expectedVersion: snapshot.version },
    {
      _tag: "InsertDecision",
      proposalTag: "ConfirmAvailability",
      policyTag: "accepted",
      evidenceIds: proposal.evidenceIds,
      reason: proposal.reason,
    },
    { _tag: "InsertVoicePlacing", idempotencyKey: `call:${snapshot.caseId}` },
    { _tag: "EnqueuePlaceCall" },
    { _tag: "InsertOutbox", dedupKey: event.dedupKey },
  ])
}

function onPlaced(snapshot: CaseSnapshot, event: Extract<DomainEvent, { _tag: "CallPlaced" }>): ReduceResult {
  if (snapshot._tag !== "Open" || snapshot.phase._tag !== "AwaitingCustomer") return { _tag: "RejectEvent" }
  return changed(snapshot.shipment.carrierStatus, [
    { _tag: "UpdateCase", phase: { _tag: "BolnaCall" }, expectedVersion: snapshot.version },
    { _tag: "MarkVoiceInFlight", executionId: event.executionId },
    { _tag: "ArmWait", waitKey: `bolna:${event.executionId}` },
    { _tag: "EnqueuePoll", executionId: event.executionId },
    { _tag: "InsertOutbox", dedupKey: event.dedupKey },
  ])
}

function onFinalized(
  snapshot: CaseSnapshot,
  event: Extract<DomainEvent, { _tag: "CallFinalized" }>,
): ReduceResult {
  if (snapshot._tag !== "Open") return { _tag: "RejectEvent" }
  if (snapshot.phase._tag === "HumanReview" && snapshot.phase.reason === "call_timeout") {
    return changed(snapshot.shipment.carrierStatus, [
      {
        _tag: "MarkVoiceCompleted",
        durationMs: event.durationMs,
        costPaise: event.costPaise,
        transcript: event.transcript,
        extractions: event.extractions,
      },
    ])
  }
  if (snapshot.phase._tag !== "BolnaCall") return { _tag: "RejectEvent" }
  const voice: RowWrite = {
    _tag: "MarkVoiceCompleted",
    durationMs: event.durationMs,
    costPaise: event.costPaise,
    transcript: event.transcript,
    extractions: event.extractions,
  }
  const satisfy: RowWrite = { _tag: "SatisfyWait", waitKey: `bolna:${event.executionId}` }
  const extraction = event.extractions
  if (extraction._tag === "Denied") {
    return changed(snapshot.shipment.carrierStatus, [
      voice,
      satisfy,
      { _tag: "UpdateCase", phase: { _tag: "Unresolved", reason: "customer_denied" }, expectedVersion: snapshot.version },
      { _tag: "InsertOutbox", dedupKey: event.dedupKey },
    ])
  }
  if (extraction._tag === "Unclear") {
    return changed(snapshot.shipment.carrierStatus, [
      voice,
      satisfy,
      { _tag: "UpdateCase", phase: { _tag: "HumanReview", reason: "call_unclear" }, expectedVersion: snapshot.version },
      { _tag: "InsertOutbox", dedupKey: event.dedupKey },
    ])
  }
  if (snapshot.permission === "deny" || snapshot.logistics.submit === "no") {
    const reason: ReviewReason = snapshot.logistics.submit === "no" ? "capability_missing" : "permission_denied"
    return changed(snapshot.shipment.carrierStatus, [
      voice,
      satisfy,
      { _tag: "UpdateCase", phase: { _tag: "HumanReview", reason }, expectedVersion: snapshot.version },
      { _tag: "InsertOutbox", dedupKey: event.dedupKey },
    ])
  }
  if (!inWindow(extraction.day, snapshot.todayIst)) {
    return changed(snapshot.shipment.carrierStatus, [
      voice,
      satisfy,
      { _tag: "UpdateCase", phase: { _tag: "HumanReview", reason: "date_out_of_window" }, expectedVersion: snapshot.version },
      { _tag: "InsertOutbox", dedupKey: event.dedupKey },
    ])
  }
  const memory: RowWrite = {
    _tag: "InsertMemory",
    dedupKey: event.dedupKey,
    fact: { availability: "confirmed", reattemptDay: extraction.day },
  }
  if (snapshot.permission === "require_human") {
    return changed(snapshot.shipment.carrierStatus, [
      voice,
      satisfy,
      memory,
      { _tag: "UpdateCase", phase: { _tag: "AwaitingApproval" }, expectedVersion: snapshot.version },
      { _tag: "InsertApproval", status: "pending", idempotencyKey: `approval:${snapshot.caseId}` },
      { _tag: "InsertOutbox", dedupKey: event.dedupKey },
    ])
  }
  return changed(snapshot.shipment.carrierStatus, [
    voice,
    satisfy,
    memory,
    { _tag: "UpdateCase", phase: { _tag: "ActionSubmitted" }, expectedVersion: snapshot.version },
    { _tag: "InsertApproval", status: "policy_granted", idempotencyKey: `approval:${snapshot.caseId}` },
    { _tag: "EnqueueSubmit", version: snapshot.version + 1 },
    { _tag: "InsertOutbox", dedupKey: event.dedupKey },
  ])
}

function onApproval(
  snapshot: CaseSnapshot,
  event: Extract<DomainEvent, { _tag: "ApprovalDecided" }>,
): ReduceResult {
  if (snapshot._tag !== "Open" || snapshot.phase._tag !== "AwaitingApproval") return { _tag: "RejectEvent" }
  if (event.decision === "denied") {
    return changed(snapshot.shipment.carrierStatus, [
      { _tag: "UpdateCase", phase: { _tag: "Unresolved", reason: "approval_denied" }, expectedVersion: snapshot.version },
      { _tag: "InsertOutbox", dedupKey: event.dedupKey },
    ])
  }
  return changed(snapshot.shipment.carrierStatus, [
    { _tag: "UpdateCase", phase: { _tag: "ActionSubmitted" }, expectedVersion: snapshot.version },
    { _tag: "EnqueueSubmit", version: snapshot.version + 1 },
    { _tag: "InsertOutbox", dedupKey: event.dedupKey },
  ])
}

function onAccepted(snapshot: CaseSnapshot, dedupKey: DedupKey): ReduceResult {
  if (snapshot._tag !== "Open" || snapshot.phase._tag !== "ActionSubmitted") return { _tag: "RejectEvent" }
  if (snapshot.logistics._tag !== "demo-carrier") {
    return reviewing(snapshot, "capability_missing", dedupKey)
  }
  return changed("reattempt_submitted", [
    { _tag: "UpdateCase", phase: { _tag: "AwaitingCarrierOutcome" }, expectedVersion: snapshot.version },
    { _tag: "InsertReceipt", idempotencyKey: `receipt:${snapshot.caseId}:${snapshot.version}` },
    { _tag: "InsertOutbox", dedupKey },
  ])
}

function onAdvanced(
  snapshot: CaseSnapshot,
  event: Extract<DomainEvent, { _tag: "CarrierAdvanced" }>,
): ReduceResult {
  if (snapshot._tag !== "Open" || snapshot.phase._tag !== "AwaitingCarrierOutcome") return { _tag: "RejectEvent" }
  const phase: OpenPhase = event.result === "delivered" ? { _tag: "Delivered" } : { _tag: "Returned" }
  const source = snapshot.logistics._tag === "demo-carrier" ? "simulated" : "live"
  return changed(event.result === "delivered" ? "delivered" : "returned", [
    { _tag: "UpdateCase", phase, expectedVersion: snapshot.version },
    { _tag: "InsertOutcome", source, result: event.result },
    { _tag: "InsertShipmentEvent", dedupKey: event.dedupKey },
    { _tag: "InsertOutbox", dedupKey: event.dedupKey },
  ])
}

function reviewing(snapshot: CaseSnapshot, reason: ReviewReason, dedupKey: DedupKey): ReduceResult {
  if (snapshot._tag !== "Open") return { _tag: "RejectEvent" }
  if (isClosed(snapshot.phase)) return { _tag: "RejectEvent" }
  return changed(snapshot.shipment.carrierStatus, [
    { _tag: "UpdateCase", phase: { _tag: "HumanReview", reason }, expectedVersion: snapshot.version },
    { _tag: "InsertOutbox", dedupKey },
  ])
}

export type PromptFacts = {
  shipmentRef: string
  codAmountPaise: number
  carrierStatus: CarrierStatus
  contact: ContactPolicy
  phase: string
  evidenceIds: ReadonlyArray<string>
}

export const toPromptFacts = (snapshot: CaseSnapshot): PromptFacts => ({
  shipmentRef: snapshot.shipment.ref,
  codAmountPaise: snapshot.shipment.codAmountPaise,
  carrierStatus: snapshot.shipment.carrierStatus,
  contact: snapshot.shipment.contact,
  phase: snapshot._tag === "Open" ? snapshot.phase._tag : "NoCase",
  evidenceIds: snapshot.shipment.evidenceIds,
})

export const renderPrompt = (facts: PromptFacts): string =>
  [
    "You are the planner for a failed-delivery recovery. Reply with JSON only.",
    "Shape: {\"_tag\":\"ConfirmAvailability\"|\"NoCall\"|\"HumanReview\",\"evidenceIds\":string[],\"reason\":string}",
    "Cite only evidence ids from the facts. Do not invent a phone number.",
    JSON.stringify(facts),
  ].join("\n")
