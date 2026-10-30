"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Bot, ClipboardList, LayoutDashboard, Plug, ShieldCheck } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const links = [
  { href: "/desk", label: "Overview", icon: LayoutDashboard },
  { href: "/queue", label: "Queue", icon: ClipboardList },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/analytics", label: "ROI", icon: BarChart3 },
]

const activeLink = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

export function RescueSidebar() {
  const pathname = usePathname()
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">Always on</p>
          <p className="text-sm font-semibold tracking-tight">Delivery Rescue</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Desk</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={activeLink(pathname, item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 pb-1 text-xs leading-5 text-muted-foreground">
          Closing this page does not stop the worker.
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
