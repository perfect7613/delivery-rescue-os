"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { RescueSidebar } from "@/components/rescue-sidebar"
import { cn } from "@/lib/utils"

export type DeskStatus = {
  connected: boolean
  live: boolean
  mode: string
  pending: number
  workerId: string | null
  ageSeconds: number | null
}

const crumbFor = (pathname: string) => {
  if (pathname.startsWith("/shipments")) return ["Queue", "Shipment"]
  if (pathname.startsWith("/queue")) return ["Desk", "Queue"]
  if (pathname.startsWith("/integrations")) return ["Setup", "Integrations"]
  if (pathname.startsWith("/agent")) return ["Setup", "Agent"]
  if (pathname.startsWith("/approvals")) return ["Desk", "Approvals"]
  if (pathname.startsWith("/analytics")) return ["Review", "Outcomes"]
  return ["Desk", "Overview"]
}

export function DeskShell({ status, children }: { status: DeskStatus; children: ReactNode }) {
  const pathname = usePathname()
  const [section, page] = crumbFor(pathname)
  const paused = status.mode === "paused"
  return (
    <SidebarProvider>
      <RescueSidebar status={status} />
      <SidebarInset className="paper-grain min-w-0 bg-paper">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-paper/85 px-4 backdrop-blur-md sm:px-8">
          <SidebarTrigger aria-label="Toggle navigation" className="-ml-1.5" />
          <p className="flex min-w-0 items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase">
            {pathname.startsWith("/shipments") ? (
              <Link href="/queue" className="text-faint hover:text-ink">
                {section}
              </Link>
            ) : (
              <span className="text-faint">{section}</span>
            )}
            <span className="text-faint/60">/</span>
            <span className="truncate text-ink">{page}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            {status.pending > 0 ? (
              <Link
                href="/approvals"
                className="inline-flex h-8 items-center gap-2 rounded-full bg-signal-soft px-3 font-mono text-[11px] tracking-[0.06em] text-signal uppercase ring-1 ring-signal/25 transition-colors hover:bg-signal hover:text-white"
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {status.pending} waiting on you
              </Link>
            ) : null}
            <Link
              href="/agent"
              className={cn(
                "inline-flex h-8 items-center gap-2.5 rounded-full bg-white px-3 font-mono text-[11px] tracking-[0.06em] uppercase ring-1 ring-border transition-shadow hover:ring-ink/30",
              )}
            >
              <span className="lamp" data-on={status.live && !paused} aria-hidden />
              <span className="hidden sm:inline">
                {!status.connected ? "Not connected" : paused ? "Intake paused" : status.live ? "Worker on" : "Worker away"}
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-6 px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
