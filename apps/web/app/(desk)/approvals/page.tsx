import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Setup } from "@/components/setup"
import { approvals, connected } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function ApprovalsPage() {
  if (!connected()) return <Setup />
  const rows = await approvals()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Held carrier actions</CardTitle>
        <CardDescription>
          Auto permission submits the simulated reattempt itself. This list is only what a person still has to release.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is waiting on a person.</p> : null}
        {rows.map((row) => (
          <div key={String(row.id)} className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{String(row.ref)}</p>
            <Badge variant="secondary">{String(row.status)}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
