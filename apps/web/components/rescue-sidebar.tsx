"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Bot, ClipboardList, LayoutDashboard, Plug, ShieldCheck } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { DeskStatus } from "@/components/shell"

const groups = [
  {
    label: "Desk",
    links: [
      { href: "/desk", label: "Overview", icon: LayoutDashboard },
      { href: "/queue", label: "Queue", icon: ClipboardList },
      { href: "/approvals", label: "Approvals", icon: ShieldCheck, badge: "pending" as const },
    ],
  },
  {
    label: "Setup",
    links: [
      { href: "/agent", label: "Agent", icon: Bot },
      { href: "/integrations", label: "Integrations", icon: Plug },
      { href: "/analytics", label: "Outcomes", icon: Activity },
    ],
  },
]

const activeLink = (pathname: string, href: string) =>
  pathname.startsWith(href) || (href === "/queue" && pathname.startsWith("/shipments"))

export function RescueSidebar({ status }: { status: DeskStatus }) {
  const pathname = usePathname()
  const paused = status.mode === "paused"
  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="px-4 pt-5 pb-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Delivery Rescue home">
          <Cairn />
          <span className="font-serif text-[1.5rem] leading-none tracking-[-0.02em] text-white">Rescue</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-1">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-mono text-[10px] tracking-[0.18em] text-sidebar-foreground/40 uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.links.map((item) => {
                  const active = activeLink(pathname, item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className="h-9 text-sidebar-foreground/70 hover:text-white data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-white"
                      >
                        <Link href={item.href}>
                          <item.icon className={active ? "text-signal" : undefined} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {"badge" in item && status.pending > 0 ? (
                        <SidebarMenuBadge className="top-2! rounded-full bg-signal px-1.5 font-mono text-[10px] text-white">
                          {status.pending}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Link
          href="/agent"
          className="block rounded-xl bg-white/[0.04] p-3.5 ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.07]"
        >
          <div className="flex items-center gap-2.5">
            <span className="lamp" data-on={status.live && !paused} aria-hidden />
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-white uppercase">
              {paused ? "Intake paused" : status.live ? "Worker on" : "Worker away"}
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-[1.45] text-sidebar-foreground/55">
            {status.live && status.ageSeconds !== null
              ? `Heartbeat ${status.ageSeconds}s ago. Closing this page does not stop it.`
              : "Closing this page does not stop the worker."}
          </p>
        </Link>
      </SidebarFooter>
    </Sidebar>
  )
}

function Cairn() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <ellipse cx="11" cy="17.5" rx="6.2" ry="2.4" fill="#f7f6f2" />
      <ellipse cx="11" cy="12.2" rx="4.6" ry="2.1" fill="#f7f6f2" />
      <ellipse cx="11" cy="7.6" rx="3" ry="1.8" fill="var(--signal)" />
    </svg>
  )
}
