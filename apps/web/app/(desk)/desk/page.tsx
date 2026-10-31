import Link from "next/link"
import type { CSSProperties } from "react"
import { ArrowUpRight } from "lucide-react"
import { ThroughputChart } from "@/components/throughput-chart"
import { Setup } from "@/components/setup"
import { Empty, PageTitle, Panel, PhaseTag, RouteLine } from "@/components/desk"
import { ago, phaseLabel, phaseTone, rupees } from "@/lib/labels"
import {
  agentMode,
  approvals,
  connected,
  openCaseCount,
  overview,
  queue,
  recentActivity,
  throughput,
  workerLamp,
} from "@/lib/queries"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  if (!connected()) return <Setup />
  const [lamp, counts, mode, openCases, pending, rows, activity, chart] = await Promise.all([
    workerLamp(),
    overview(),
    agentMode(),
    openCaseCount(),
    approvals(),
    queue(),
    recentActivity(),
    throughput(),
  ])
  const live = lamp !== null && lamp.ageSeconds < 20
  const needsPerson = rows.filter((row) => phaseTone(String(row.phase)) === "signal").length
  const atRisk = rows.reduce((sum, row) => sum + Number(row.cod_amount_paise), 0)
  const stats = [
    { label: "Open cases", value: String(openCases), hint: "Still moving in the journal", href: "/queue" },
    { label: "At stake", value: rupees(atRisk), hint: "Cash on delivery across open cases", href: "/queue" },
    { label: "Calls placed", value: String(counts.calls), hint: "Bolna executions, not simulated deliveries" },
    {
      label: "Needs a person",
      value: String(needsPerson),
      hint: `${pending.length} held ${pending.length === 1 ? "approval" : "approvals"}; auto permission submits the rest`,
      href: pending.length > 0 ? "/approvals" : "/queue",
      signal: needsPerson > 0,
    },
  ]

  return (
    <>
      <PageTitle
        kicker={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        title={
          openCases === 0 ? (
            <>Nothing is stuck right now.</>
          ) : (
            <>
              {openCases} {openCases === 1 ? "parcel is" : "parcels are"} <em className="text-mute">being rescued.</em>
            </>
          )
        }
        lede={
          live
            ? `The worker ${lamp?.workerId} heartbeat ${lamp?.ageSeconds}s ago in ${mode} mode. It keeps going if you close this page.`
            : lamp
              ? `The last heartbeat was ${ago(lamp.lastSeenAt)}. Opening the desk wakes the worker; npm run always-on keeps it resident.`
              : "No worker has reported in yet. Start npm run always-on, or open the desk to wake it once."
        }
      />

      <dl className="panel rise grid grid-cols-2 overflow-hidden lg:grid-cols-4" style={{ "--i": 1 } as CSSProperties}>
        {stats.map((stat, index) => {
          const body = (
            <>
              <dt className="kicker flex items-center gap-1.5">
                {stat.signal ? <span className="size-1.5 rounded-full bg-signal" aria-hidden /> : null}
                {stat.label}
              </dt>
              <dd className={cn("numeral mt-3 text-[2.75rem] leading-none", stat.signal && "text-signal")}>{stat.value}</dd>
              <p className="mt-2 text-[12.5px] leading-snug text-mute">{stat.hint}</p>
            </>
          )
          const cell = cn(
            "group relative block p-5 transition-colors",
            index % 2 === 1 && "border-l border-border",
            index >= 2 && "border-t border-border lg:border-t-0",
            index === 2 && "lg:border-l",
            stat.href && "hover:bg-paper/70",
          )
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className={cell}>
              {body}
              <ArrowUpRight className="absolute top-4 right-4 size-4 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ) : (
            <div key={stat.label} className={cell}>
              {body}
            </div>
          )
        })}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          index={2}
          kicker="On the line"
          title="Open recoveries"
          note="Each case travels the same six stops. Orange means a person is needed."
          action={
            <Link href="/queue" className="kicker whitespace-nowrap hover:text-ink">
              Queue →
            </Link>
          }
          bodyClassName="p-0"
        >
          {rows.length === 0 ? (
            <div className="p-5">
              <Empty title="The queue is clear.">A new failed delivery appears here on its own and wakes the worker.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.slice(0, 6).map((row) => {
                const phase = String(row.phase)
                return (
                  <li key={String(row.id)}>
                    <Link href={`/shipments/${row.shipment_id}`} className="block px-5 py-4 transition-colors hover:bg-paper/70">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-baseline gap-3">
                          <span className="ledger-ref truncate text-[14px]">{String(row.ref)}</span>
                          <span className="hidden truncate font-mono text-[11px] text-faint sm:inline">
                            {String(row.current_carrier_status).toUpperCase()} · {rupees(Number(row.cod_amount_paise))}
                          </span>
                        </div>
                        <PhaseTag phase={phase} />
                      </div>
                      <RouteLine phase={phase} className="mt-4" />
                      <p className="mt-3 font-mono text-[10.5px] text-faint">Updated {ago(row.updated_at)}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel index={3} kicker="Ledger" title="Recent decisions" note="What the planner proposed and whether policy let it through." bodyClassName="p-0">
          {activity.length === 0 ? (
            <div className="p-5">
              <Empty title="No model decision yet." />
            </div>
          ) : (
            <ol className="relative px-5 py-2">
              <span className="absolute top-6 bottom-6 left-[27px] w-px bg-border" aria-hidden />
              {activity.map((entry, index) => {
                const accepted = String(entry.policy_tag) === "accepted"
                return (
                  <li key={index} className="relative flex gap-4 py-3">
                    <span
                      className={cn(
                        "relative z-10 mt-1.5 size-[9px] shrink-0 rounded-full ring-4 ring-white",
                        accepted ? "bg-ink" : "bg-signal",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-snug">
                        <span className="font-medium">{phaseLabel(String(entry.proposal_tag))}</span>
                        <span className="text-mute"> on </span>
                        <span className="ledger-ref text-[13px]">{String(entry.ref)}</span>
                      </p>
                      <p className="mt-1 font-mono text-[10.5px] tracking-[0.04em] text-faint uppercase">
                        <span className={accepted ? "text-mute" : "text-signal"}>{String(entry.policy_tag)}</span> ·{" "}
                        {ago(entry.created_at)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </Panel>
      </div>

      <Panel
        index={4}
        kicker="Last eight days"
        title="Recovery throughput"
        note="Carrier events against verified outcomes. Outcomes in this demo are simulated."
      >
        <ThroughputChart data={chart} />
      </Panel>
    </>
  )
}
