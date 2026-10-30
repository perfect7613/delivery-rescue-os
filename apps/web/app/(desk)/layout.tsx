import { DeskShell } from "@/components/shell"
import { LivePulse } from "@/components/live-pulse"
import { wakeWorker } from "@/lib/wake"

export const dynamic = "force-dynamic"

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PHASE !== "phase-production-build") wakeWorker(12_000, true)
  return (
    <>
      <LivePulse />
      <DeskShell>{children}</DeskShell>
    </>
  )
}
