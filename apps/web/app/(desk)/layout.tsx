import { DeskShell, type DeskStatus } from "@/components/shell"
import { LivePulse } from "@/components/live-pulse"
import { agentMode, approvals, connected, workerLamp } from "@/lib/queries"
import { wakeWorker } from "@/lib/wake"

export const dynamic = "force-dynamic"

async function deskStatus(): Promise<DeskStatus> {
  if (!connected()) return { connected: false, live: false, mode: "running", pending: 0, workerId: null, ageSeconds: null }
  try {
    const [lamp, mode, pending] = await Promise.all([workerLamp(), agentMode(), approvals()])
    return {
      connected: true,
      live: lamp !== null && lamp.ageSeconds < 20,
      mode,
      pending: pending.length,
      workerId: lamp?.workerId ?? null,
      ageSeconds: lamp?.ageSeconds ?? null,
    }
  } catch {
    return { connected: true, live: false, mode: "running", pending: 0, workerId: null, ageSeconds: null }
  }
}

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PHASE !== "phase-production-build") wakeWorker(12_000, true)
  const status = await deskStatus()
  return (
    <>
      <LivePulse />
      <DeskShell status={status}>{children}</DeskShell>
    </>
  )
}
