export const phaseLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2")

const progressByPhase: Record<string, number> = {
  Detected: 12,
  Evaluating: 28,
  AwaitingCustomer: 42,
  BolnaCall: 58,
  AwaitingApproval: 72,
  HumanReview: 64,
  ActionSubmitted: 82,
  AwaitingCarrierOutcome: 90,
  Delivered: 100,
  Returned: 100,
  Unresolved: 100,
}

export const phaseProgress = (phase: string) => progressByPhase[phase] ?? 16

export const phaseBadge = (phase: string): "default" | "secondary" | "outline" => {
  if (phase === "HumanReview" || phase === "AwaitingApproval") return "secondary"
  if (phase === "Delivered" || phase === "Returned" || phase === "Unresolved") return "outline"
  return "default"
}

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

export const when = (value: unknown) =>
  new Date(String(value)).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

/** The stops a case travels through, in the order the operator sees them. */
export const routeStops = ["Detected", "Plan", "Call", "Review", "Rebook", "Outcome"] as const

const stopByPhase: Record<string, number> = {
  Detected: 0,
  Evaluating: 1,
  AwaitingCustomer: 2,
  BolnaCall: 2,
  HumanReview: 3,
  AwaitingApproval: 3,
  ActionSubmitted: 4,
  AwaitingCarrierOutcome: 4,
  Delivered: 5,
  Returned: 5,
  Unresolved: 5,
}

export const phaseStop = (phase: string) => stopByPhase[phase] ?? 0

export type PhaseTone = "moving" | "signal" | "live" | "quiet"

/** Signal means a person is needed. Live means verified delivered. Quiet means closed without a delivery. */
export const phaseTone = (phase: string): PhaseTone => {
  if (phase === "HumanReview" || phase === "AwaitingApproval") return "signal"
  if (phase === "Delivered") return "live"
  if (phase === "Returned" || phase === "Unresolved") return "quiet"
  return "moving"
}

export const ago = (value: unknown) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(String(value)).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86_400)}d ago`
}
