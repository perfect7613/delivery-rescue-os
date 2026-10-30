import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Setup } from "@/components/setup"
import { agentMode, connected, workerLamp } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function AgentPage() {
  if (!connected()) return <Setup />
  const [mode, lamp] = await Promise.all([agentMode(), workerLamp()])
  const live = lamp !== null && lamp.ageSeconds < 20
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{live ? "On the floor" : "Not heartbeating"}</CardTitle>
        <CardDescription>
          Mode {mode}. The process is npm run always-on. It claims leased jobs and resumes after a restart. Pause holds
          new failures at the door. A case already moving keeps its lease.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <form action="/api/agent" method="post">
          <Button name="mode" value="paused" variant="outline" type="submit">
            Pause intake
          </Button>
        </form>
        <form action="/api/agent" method="post">
          <Button name="mode" value="running" type="submit">
            Resume
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
