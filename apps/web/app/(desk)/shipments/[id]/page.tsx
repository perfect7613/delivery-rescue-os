import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Setup } from "@/components/setup"
import { rupees, when } from "@/lib/labels"
import { connected, shipment } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!connected()) return <Setup />
  const { id } = await params
  const data = await shipment(id)
  if (!data.shipment) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Not on the desk</CardTitle>
          <CardDescription>That reference is not in this merchant&apos;s journal.</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  const row = data.shipment
  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{String(row.ref)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {String(row.current_carrier_status).toUpperCase()} · {rupees(Number(row.cod_amount_paise))} ·{" "}
          {String(row.contact_policy).replaceAll("_", " ")}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {data.events.length === 0 ? <p className="text-sm text-muted-foreground">No carrier events yet.</p> : null}
            <ol className="flex flex-col">
              {data.events.map((event, index) => (
                <li key={index} className="relative border-l py-3 pl-4">
                  <p className="text-sm">{String(event.kind).replaceAll("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">{when(event.created_at)}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Decisions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {data.decisions.length === 0 ? <p className="text-muted-foreground">No model decision yet.</p> : null}
            {data.decisions.map((decision, index) => (
              <div key={index}>
                <p>
                  {String(decision.proposal_tag)} · {String(decision.policy_tag)}
                </p>
                <p className="text-muted-foreground">{String(decision.reason)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Call</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {data.calls.length === 0 ? (
              <p className="text-muted-foreground">No call. Opt-out and already-delivered cases stay silent.</p>
            ) : null}
            {data.calls.map((call, index) => (
              <div key={index}>
                <p>
                  {String(call.status)} · {String(call.execution_id ?? "waiting for execution id")}
                </p>
                {call.cost_paise != null ? (
                  <p className="text-muted-foreground">Bolna reported {String(call.cost_paise)} minor units</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outcome</CardTitle>
            <CardDescription>
              {data.outcomes.length === 0
                ? "Not verified yet."
                : data.outcomes
                    .map((outcome) =>
                      `${String(outcome.result)} · ${outcome.source === "simulated" ? "Synthetic — not measured customer ROI" : "Live carrier"}`,
                    )
                    .join(" ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/demo/simulator" method="post">
              <input type="hidden" name="fixture" value="advance" />
              <input type="hidden" name="ref" value={String(row.ref)} />
              <Button type="submit">Advance simulator to delivered</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
