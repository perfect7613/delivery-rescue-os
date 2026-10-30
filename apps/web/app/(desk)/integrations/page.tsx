import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Setup } from "@/components/setup"
import { phaseLabel } from "@/lib/labels"
import { connected, connections } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function IntegrationsPage() {
  if (!connected()) return <Setup />
  const rows = await connections()
  return (
    <>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Bolna and Sarvam keys stay in the server env. They are never sent to the model and never rendered here.
        Shiprocket is listed and read-only. Coming-soon entries cannot be activated.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => {
          const live = Boolean(row.active)
          return (
            <Card key={String(row.connector_id)}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="capitalize">{phaseLabel(String(row.connector_id))}</CardTitle>
                <Badge variant={live ? "default" : "outline"}>{live ? "Active" : "Inactive"}</Badge>
              </CardHeader>
              <CardContent>
                <CardDescription className="capitalize">
                  {String(row.kind)} · {phaseLabel(String(row.availability))}
                </CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
