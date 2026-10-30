import { DeskShell } from "@/components/shell"
import { LivePulse } from "@/components/live-pulse"

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LivePulse />
      <DeskShell>{children}</DeskShell>
    </>
  )
}
