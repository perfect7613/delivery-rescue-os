"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Search } from "lucide-react"
import type { ReactNode } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { RescueSidebar } from "@/components/rescue-sidebar"

const titleFor = (pathname: string) => {
  if (pathname.startsWith("/shipments")) return "Shipment"
  if (pathname.startsWith("/queue")) return "Rescue queue"
  if (pathname.startsWith("/integrations")) return "Integrations"
  if (pathname.startsWith("/agent")) return "Agent"
  if (pathname.startsWith("/approvals")) return "Approvals"
  if (pathname.startsWith("/analytics")) return "ROI"
  if (pathname.startsWith("/desk")) return "Rescue desk"
  return "Rescue desk"
}

export function DeskShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <SidebarProvider>
      <RescueSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background px-4 sm:px-6">
          <SidebarTrigger aria-label="Toggle navigation" />
          <h1 className="truncate text-lg font-semibold">{titleFor(pathname)}</h1>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/queue" aria-label="Open the queue">
                <Search />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/approvals" aria-label="Approvals">
                <Bell />
              </Link>
            </Button>
            <Avatar className="ml-1 size-8">
              <AvatarFallback>DR</AvatarFallback>
            </Avatar>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
