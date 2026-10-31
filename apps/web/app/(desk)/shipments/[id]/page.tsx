import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { Setup } from "@/components/setup"
import { Empty, Fact, Panel, PhaseTag, RouteLine, Tag } from "@/components/desk"
import { ago, phaseLabel, phaseTone, rupees, when } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { connected, shipment } from "@/lib/queries"

export const dynamic = "force-dynamic"

const label = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ")
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null
const timestamp = (value: unknown) => {
  const valueText = text(value)
  return valueText && Number.isFinite(Date.parse(valueText)) ? when(valueText) : "Not reported"
}
const duration = (ms: unknown) => {
  if (ms == null) return "Not reported"
  const seconds = Math.round(Number(ms) / 1000)
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
}
const recording = (value: unknown) => {
  try {
    const url = new URL(String(value))
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

function Fields({ value }: { value: unknown }) {
  if (value == null || value === "") return <span className="text-muted-foreground">Not reported</span>
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-muted-foreground">None reported</span>
    return <ul className="space-y-2">{value.map((item, index) => <li key={index}><Fields value={item} /></li>)}</ul>
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
    if (!entries.length) return <span className="text-muted-foreground">None reported</span>
    return (
      <dl className="space-y-2.5">
        {entries.map(([key, item]) => (
          <div key={key} className="grid gap-1 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
            <dt className="font-mono text-[11px] tracking-[0.06em] text-faint uppercase sm:pt-0.5">{label(key)}</dt>
            <dd className="min-w-0 break-words"><Fields value={item} /></dd>
          </div>
        ))}
      </dl>
    )
  }
  return <span className="whitespace-pre-wrap break-words">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</span>
}

function Transcript({ value }: { value: unknown }) {
  const transcript = text(value)
  if (!transcript) return <Empty title="No transcript yet.">A connected call may still have no speech.</Empty>
  const turns: { speaker: string; content: string }[] = []
  for (const line of transcript.split("\n").filter((line) => line.trim())) {
    const match = line.match(/^\s*(assistant|user|agent|customer)\s*:\s*(.*)$/i)
    if (match) {
      turns.push({ speaker: /assistant|agent/i.test(match[1]!) ? "Rescue" : "Customer", content: match[2]! })
    } else if (turns.length) {
      turns[turns.length - 1]!.content += `\n${line}`
    } else {
      turns.push({ speaker: "Transcript", content: line })
    }
  }
  return (
    <ol className="flex max-h-[34rem] flex-col gap-3 overflow-y-auto rounded-xl bg-paper p-4 ring-1 ring-border" aria-label="Call transcript">
      {turns.map((turn, index) => {
        const rescue = turn.speaker === "Rescue"
        return (
          <li key={index} className={cn("flex max-w-[88%] flex-col gap-1", rescue ? "self-start" : "self-end items-end")}>
            <span className="px-1 font-mono text-[9.5px] tracking-[0.14em] text-faint uppercase">{turn.speaker}</span>
            <p
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words",
                rescue ? "rounded-tl-md bg-ink text-paper" : "rounded-tr-md bg-white text-ink ring-1 ring-border",
              )}
            >
              {turn.content}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return <h4 className="kicker mb-2.5">{children}</h4>
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl ring-1 ring-border open:bg-paper/60">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <span className="font-mono text-faint transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-3 px-4 pb-4 text-[13px]">{children}</div>
    </details>
  )
}

const statusTone = (status: string): "plain" | "signal" | "live" | "ink" => {
  if (/fail|error|cancel|reject|dead/i.test(status)) return "signal"
  if (/complete|done|success|granted|submitted|accepted/i.test(status)) return "live"
  if (/pending|running|progress|queued|in_flight|placing/i.test(status)) return "ink"
  return "plain"
}

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!connected()) return <Setup />
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  const data = await shipment(id)
  if (!data.shipment) notFound()
  const row = data.shipment
  const currentCase = data.cases[0]
  const phase = currentCase ? String(currentCase.phase) : null
  const needsPerson = phase ? phaseTone(phase) === "signal" : false

  return (
    <>
      <header className="rise flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Shipment{currentCase ? ` · case v${String(currentCase.version)}` : ""}</p>
            <h2 className="ledger-ref mt-2 text-[2.4rem] leading-none tracking-[-0.02em] md:text-[3rem]">{String(row.ref)}</h2>
          </div>
          {phase ? <PhaseTag phase={phase} className="h-7 px-3 text-[11px]" /> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-4 sm:grid-cols-4">
          <Fact label="Carrier says">{String(row.current_carrier_status).toUpperCase()}</Fact>
          <Fact label="Cash on delivery">
            <span className="numeral text-[1.35rem] leading-none">{rupees(Number(row.cod_amount_paise))}</span>
          </Fact>
          <Fact label="Contact policy">
            <span className={cn("capitalize", String(row.contact_policy) === "opted_out" && "text-signal")}>
              {label(String(row.contact_policy))}
            </span>
          </Fact>
          <Fact label="Phone">
            <span className="font-mono text-[13px]">{row.phone_mask ? String(row.phone_mask) : "Not on file"}</span>
          </Fact>
        </dl>
        {phase ? (
          <div className="panel px-5 pt-5 pb-4">
            <RouteLine phase={phase} />
            {currentCase?.review_reason ? (
              <p className={cn("mt-4 rounded-lg px-3 py-2 text-[13px]", needsPerson ? "bg-signal-soft text-signal" : "bg-paper text-mute")}>
                <span className="font-medium">Needs review:</span> {label(String(currentCase.review_reason))}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel index={1} kicker="Bolna" title="Calls" note="Saved call details and transcripts. A completed call is not proof of delivery.">
            {!data.calls.length ? <Empty title="No call placed.">Opt-out and already-delivered cases stay silent.</Empty> : null}
            <div className="divide-y divide-border">
              {data.calls.map((call) => {
                const details = object(call.provider_details)
                const audio = recording(details.recording_url)
                const status = text(details.status) ?? String(call.status)
                return (
                  <section key={String(call.id)} className="space-y-6 py-6 first:pt-0 last:pb-0" aria-label="Call details">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <Tag tone={statusTone(status)}>{label(status)}</Tag>
                        <p className="font-mono text-[11px] break-all text-faint">
                          exec {String(call.execution_id ?? "awaiting execution id")}
                        </p>
                      </div>
                      <p className="font-mono text-[11px] text-faint">
                        synced {timestamp(call.synced_at instanceof Date ? call.synced_at.toISOString() : call.synced_at)}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-4">
                      {[
                        ["Duration", <span key="d" className="numeral text-[1.5rem] leading-none">{duration(call.duration_ms)}</span>],
                        [
                          "Reported cost",
                          call.cost_paise == null ? (
                            "Not reported"
                          ) : (
                            <span key="c">
                              <span className="numeral text-[1.5rem] leading-none">{String(call.cost_paise)}</span>{" "}
                              <span className="text-[11px] text-faint">minor units</span>
                            </span>
                          ),
                        ],
                        ["Started", timestamp(details.initiated_at ?? details.created_at)],
                        ["Ended because", <span key="e" className="capitalize">{label(text(details.termination_reason) ?? "Not reported")}</span>],
                      ].map(([name, value]) => (
                        <div key={String(name)} className="bg-white p-3.5">
                          <dt className="kicker">{name}</dt>
                          <dd className="mt-2 text-[14px]">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {details.error_message ? (
                      <p className="rounded-xl bg-signal-soft px-4 py-3 text-[13px] text-signal ring-1 ring-signal/20">
                        {String(details.error_message)}
                      </p>
                    ) : null}
                    <div className="grid gap-6 xl:grid-cols-2">
                      <div className="space-y-6">
                        <div>
                          <Sub>Summary</Sub>
                          <p className="font-serif text-[1.15rem] leading-[1.5] whitespace-pre-wrap text-ink/85">
                            {text(details.summary) ?? "No summary supplied by Bolna for this call."}
                          </p>
                        </div>
                        <div>
                          <Sub>Recovery result</Sub>
                          <div className="rounded-xl bg-paper p-4 text-[13.5px] ring-1 ring-border">
                            <Fields value={call.extraction} />
                          </div>
                        </div>
                        <div>
                          <Sub>Recording</Sub>
                          {audio ? (
                            <>
                              <audio controls preload="none" src={audio} className="h-10 w-full" aria-label="Call recording" />
                              <p className="mt-2 text-[12px] text-faint">
                                Hosted by Bolna or its telephony provider; availability follows their retention and access rules.
                              </p>
                            </>
                          ) : (
                            <p className="text-[13px] text-mute">No recording URL supplied by Bolna.</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Fold title="All extracted responses">
                            <Fields value={details.extracted_data} />
                            {details.custom_extractions != null ? <Fields value={details.custom_extractions} /> : null}
                          </Fold>
                          <Fold title="Provider details & cost breakdown">
                            <Fields
                              value={{
                                provider: details.provider,
                                processing_status: details.processing_status,
                                cost_breakdown: details.cost_breakdown,
                              }}
                            />
                          </Fold>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <Sub>Transcript</Sub>
                        <Transcript value={call.transcript} />
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          </Panel>

          <Panel index={2} kicker="Ledger" title="Timeline" note="Carrier, planner, and call events, oldest first." bodyClassName="p-0">
            {!data.events.length ? (
              <div className="p-5">
                <Empty title="No events yet." />
              </div>
            ) : (
              <ol className="relative max-h-[30rem] overflow-y-auto px-5 py-3">
                {data.events.map((event, index) => (
                  <li key={String(event.id)} className="relative flex gap-4 pb-4 last:pb-1">
                    <span className="flex flex-col items-center pt-1.5" aria-hidden>
                      <span className={cn("size-[9px] rounded-full", index === data.events.length - 1 ? "bg-ink" : "bg-white ring-2 ring-ink/25")} />
                      {index < data.events.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                    </span>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-[14px] font-medium">{label(String(event.kind))}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] tracking-[0.04em] text-faint uppercase">
                        {when(event.created_at)} · {String(event.source)} · {String(event.apply_status)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Panel index={2} kicker="Verified" title="Outcome" note="Delivery verification is separate from call completion.">
            {!data.outcomes.length ? (
              <Empty title="Not verified yet.">No delivered outcome has been recorded.</Empty>
            ) : (
              <ul className="space-y-3">
                {data.outcomes.map((outcome, index) => (
                  <li key={index} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-serif text-[1.6rem] leading-none capitalize">{phaseLabel(String(outcome.result))}</span>
                    <Tag tone={outcome.source === "simulated" ? "plain" : "live"}>
                      {outcome.source === "simulated" ? "Simulated, not real" : "Live carrier"}
                    </Tag>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel index={3} kicker="Carrier" title="Recovery actions" note="Policy approvals and reattempt receipts.">
            {!data.actions.length ? <Empty title="No reattempt yet.">Nothing authorized or submitted.</Empty> : null}
            <ul className="space-y-4">
              {data.actions.map((action) => (
                <li key={String(action.id)} className="space-y-2.5 rounded-xl bg-paper p-4 ring-1 ring-border">
                  <div className="flex items-center justify-between gap-2">
                    <Tag tone={statusTone(String(action.status))}>{label(String(action.status))}</Tag>
                  </div>
                  <p className="text-[14px]">
                    <span className="text-mute">Preferred day </span>
                    <span className="font-serif text-[1.25rem]">{String(action.reattempt_day ?? "not confirmed")}</span>
                  </p>
                  <p className="text-[12.5px] leading-snug text-mute">
                    {action.submitted_at
                      ? `Simulator accepted at ${when(action.submitted_at)}. This is not a live courier booking.`
                      : "No carrier acceptance receipt yet."}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel index={4} kicker="Planner" title="Decisions" note="Each proposal and whether policy let it through.">
            {!data.decisions.length ? <Empty title="No model decision yet." /> : null}
            <ol className="space-y-5">
              {data.decisions.map((decision, index) => {
                const accepted = String(decision.policy_tag) === "accepted"
                return (
                  <li key={index} className={cn("border-l-2 pl-4", accepted ? "border-ink" : "border-signal")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium">{label(String(decision.proposal_tag))}</p>
                      <Tag tone={accepted ? "plain" : "signal"}>{String(decision.policy_tag)}</Tag>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">{String(decision.reason)}</p>
                    <p className="mt-1.5 font-mono text-[10.5px] text-faint">{ago(decision.created_at)}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer font-mono text-[10.5px] tracking-[0.06em] text-faint uppercase hover:text-ink">
                        Evidence references
                      </summary>
                      <div className="mt-2 font-mono text-[11px] break-all text-mute">
                        <Fields value={decision.evidence_ids} />
                      </div>
                    </details>
                  </li>
                )
              })}
            </ol>
          </Panel>

          <Panel index={5} kicker="Durable jobs" title="Workflow" note="Retry counts and processing status." bodyClassName="p-0">
            {!data.jobs.length ? (
              <div className="p-5">
                <Empty title="No workflow jobs yet." />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.jobs.map((job) => (
                  <li key={String(job.id)} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{label(String(job.kind))}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-faint">
                        {String(job.attempt_count)}/{String(job.max_attempts)} tries ·{" "}
                        {job.status === "pending" ? `next ${when(job.next_run_at)}` : ago(job.updated_at)}
                      </p>
                    </div>
                    <Tag tone={statusTone(String(job.status))}>{String(job.status)}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </>
  )
}
