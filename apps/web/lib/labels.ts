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
