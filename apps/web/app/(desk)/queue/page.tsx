import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Setup } from "@/components/setup"
import { phaseLabel, rupees } from "@/lib/labels"
import { connected, queue } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function QueuePage() {
  if (!connected()) return <Setup />
  const rows = await queue()
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <form action="/api/demo/simulator" method="post">
          <input type="hidden" name="fixture" value="cod_ndr" />
          <Button type="submit">Seed ₹1,499 failure</Button>
        </form>
        <form action="/api/demo/simulator" method="post">
          <input type="hidden" name="fixture" value="opted_out" />
          <Button variant="outline" type="submit">
            Seed opted-out case
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">A seeded failure wakes the worker on its own.</p>
      </div>
      <div className="flex flex-col gap-3">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">The queue is clear.</p> : null}
        {rows.map((row) => (
          <a key={String(row.id)} href={`/shipments/${row.shipment_id}`}>
            <Card>
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{String(row.ref)}</p>
                  <p className="text-xs text-muted-foreground">
                    {phaseLabel(String(row.phase))} · {String(row.current_carrier_status).toUpperCase()}
                  </p>
                </div>
                <Badge variant="outline">{rupees(Number(row.cod_amount_paise))}</Badge>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </>
  )
}
