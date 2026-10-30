import { Schema } from "effect"

export const DemoOrgId = "00000000-0000-4000-8000-000000000001"

export const OrgId = Schema.NonEmptyString.pipe(Schema.brand("OrgId"))
export type OrgId = typeof OrgId.Type

export const DedupKey = Schema.NonEmptyString.pipe(Schema.brand("DedupKey"))
export type DedupKey = typeof DedupKey.Type

export const ExecutionId = Schema.NonEmptyString.pipe(Schema.brand("ExecutionId"))
export type ExecutionId = typeof ExecutionId.Type

export const RenderedPrompt = Schema.NonEmptyString.pipe(Schema.brand("RenderedPrompt"))
export type RenderedPrompt = typeof RenderedPrompt.Type

export const CallablePhone = Schema.NonEmptyString.pipe(Schema.brand("CallablePhone"))
export type CallablePhone = typeof CallablePhone.Type

export const mintDedup = (value: string): DedupKey => Schema.decodeUnknownSync(DedupKey)(value)

export const dedup = {
  ndr: (ref: string) => mintDedup(`sim:${ref}:ndr_created`),
  callCompleted: (executionId: string) => mintDedup(`bolna:${executionId}:completed`),
  proposal: (runId: string) => mintDedup(`model:${runId}:proposal`),
  delivered: (ref: string) => mintDedup(`sim:${ref}:delivered`),
  returned: (ref: string) => mintDedup(`sim:${ref}:returned`),
}

export const PhaseName = Schema.Literals([
  "Detected",
  "Evaluating",
  "AwaitingCustomer",
  "BolnaCall",
  "AwaitingApproval",
  "HumanReview",
  "ActionSubmitted",
  "AwaitingCarrierOutcome",
  "Delivered",
  "Returned",
  "Unresolved",
])

export const Extraction = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Confirmed"), day: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("Denied") }),
  Schema.Struct({ _tag: Schema.Literal("Unclear") }),
])
export type Extraction = typeof Extraction.Type

export const ModelProposal = Schema.Struct({
  _tag: Schema.Literals(["ConfirmAvailability", "NoCall", "HumanReview"]),
  evidenceIds: Schema.Array(Schema.String),
  reason: Schema.String,
})
export type ModelProposal = typeof ModelProposal.Type

export const DomainEvent = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("NdrCreated"),
    dedupKey: DedupKey,
    shipmentId: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("AgentResumed"),
    dedupKey: DedupKey,
    caseId: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("ModelProposal"),
    dedupKey: DedupKey,
    runId: Schema.String,
    proposal: ModelProposal,
  }),
  Schema.Struct({
    _tag: Schema.Literal("ModelRejected"),
    dedupKey: DedupKey,
    runId: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("CallPlaced"),
    dedupKey: DedupKey,
    voiceCallId: Schema.String,
    executionId: ExecutionId,
  }),
  Schema.Struct({
    _tag: Schema.Literal("CallFinalized"),
    dedupKey: DedupKey,
    executionId: ExecutionId,
    durationMs: Schema.Int,
    costPaise: Schema.Int,
    transcript: Schema.String,
    extractions: Extraction,
  }),
  Schema.Struct({
    _tag: Schema.Literal("CallTimedOut"),
    dedupKey: DedupKey,
    executionId: ExecutionId,
  }),
  Schema.Struct({
    _tag: Schema.Literal("ApprovalDecided"),
    dedupKey: DedupKey,
    approvalId: Schema.String,
    decision: Schema.Literals(["granted", "denied"]),
  }),
  Schema.Struct({
    _tag: Schema.Literal("CarrierAccepted"),
    dedupKey: DedupKey,
    caseId: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("CarrierAdvanced"),
    dedupKey: DedupKey,
    result: Schema.Literals(["delivered", "returned"]),
  }),
  Schema.Struct({
    _tag: Schema.Literal("JobExhausted"),
    dedupKey: DedupKey,
    jobDedupKey: DedupKey,
  }),
])
export type DomainEvent = typeof DomainEvent.Type

export class PayloadRejected extends Schema.TaggedError<PayloadRejected>()("PayloadRejected", {
  reason: Schema.String,
}) {}

export class LeaseLost extends Schema.TaggedError<LeaseLost>()("LeaseLost", {
  jobId: Schema.String,
}) {}

export class NotReady extends Schema.TaggedError<NotReady>()("NotReady", {
  executionId: Schema.String,
}) {}

export class ConnectorUnavailable extends Schema.TaggedError<ConnectorUnavailable>()("ConnectorUnavailable", {
  connectorId: Schema.String,
}) {}

export class MissingCredential extends Schema.TaggedError<MissingCredential>()("MissingCredential", {
  name: Schema.String,
}) {}
