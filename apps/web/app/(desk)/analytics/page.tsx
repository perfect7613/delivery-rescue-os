import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Setup } from "@/components/setup"
import { db } from "@/lib/db"
import { phaseLabel } from "@/lib/labels"
import { connected } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  if (!connected()) return <Setup />
  const rows = await db()`
    select source, result, count(*)::int as count
    from outcomes
    group by source, result
  `
  return (
    <>
      <p className="max-w-2xl text-sm text-muted-foreground">
        These counts come from the simulator. They show how the ledger separates a Bolna call from a pretend delivery.
        They are not savings.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">No outcomes yet.</p>
            </CardContent>
          </Card>
        ) : null}
        {rows.map((row, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">{phaseLabel(String(row.result))}</CardTitle>
              <Badge variant="outline">Synthetic</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{String(row.count)}</p>
              <CardDescription className="capitalize">{String(row.source)}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
