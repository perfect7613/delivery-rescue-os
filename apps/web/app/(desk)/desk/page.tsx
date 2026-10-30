import { BarChart3, ClipboardList, Phone, Radio } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ThroughputChart } from "@/components/throughput-chart"
import { Setup } from "@/components/setup"
import { phaseBadge, phaseLabel, phaseProgress, rupees, when } from "@/lib/labels"
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
  const stats = [
    {
      label: "Open cases",
      value: String(openCases),
      hint: "Still moving in the journal",
      icon: ClipboardList,
    },
    {
      label: "Calls placed",
      value: String(counts.calls),
      hint: "Bolna executions, not simulated deliveries",
      icon: Phone,
    },
    {
      label: "Waiting on a person",
      value: String(pending.length),
      hint: "Auto permission submits the rest",
      icon: BarChart3,
    },
    {
      label: "Worker",
      value: live ? "Resident" : "Away",
      hint: lamp ? `${lamp.workerId} · ${lamp.ageSeconds}s ago · ${mode}` : "Start npm run always-on",
      icon: Radio,
    },
  ]

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon aria-hidden className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recovery throughput</CardTitle>
          <CardDescription>Carrier events against verified outcomes over the last eight days</CardDescription>
        </CardHeader>
        <CardContent>
          <ThroughputChart data={chart} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open recoveries</CardTitle>
            <CardDescription>Current case progress. A seeded failure wakes the worker on its own.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">The queue is clear.</p> : null}
            {rows.map((row) => {
              const phase = String(row.phase)
              return (
                <div key={String(row.id)} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <a href={`/shipments/${row.shipment_id}`} className="truncate text-sm font-medium">
                      {String(row.ref)}
                    </a>
                    <Badge variant={phaseBadge(phase)}>{phaseLabel(phase)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {String(row.current_carrier_status).toUpperCase()} · {rupees(Number(row.cod_amount_paise))}
                  </p>
                  <div className="flex items-center gap-3">
                    <Progress value={phaseProgress(phase)} aria-label={`${String(row.ref)} progress`} />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{phaseProgress(phase)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Updated {when(row.updated_at)}</p>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Decisions written to the ledger</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? <p className="text-sm text-muted-foreground">No model decision yet.</p> : null}
            <ol className="flex flex-col gap-4">
              {activity.map((entry, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">OP</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">Operator</span>{" "}
                      <span className="text-muted-foreground">
                        {String(entry.policy_tag)} {phaseLabel(String(entry.proposal_tag))} on {String(entry.ref)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{when(entry.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
