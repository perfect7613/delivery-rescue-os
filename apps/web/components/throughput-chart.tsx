"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartConfig = {
  opened: { label: "Carrier events", color: "var(--faint)" },
  completed: { label: "Outcomes", color: "var(--signal)" },
} satisfies ChartConfig

export function ThroughputChart({
  data,
}: {
  data: { day: string; opened: number; completed: number }[]
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full font-mono text-[10.5px]">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }} accessibilityLayer>
        <defs>
          <linearGradient id="rescueCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-completed)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-completed)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--rule)" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip cursor={{ stroke: "var(--ink)", strokeOpacity: 0.15 }} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area dataKey="opened" type="monotone" stroke="var(--color-opened)" strokeDasharray="3 4" fill="none" strokeWidth={1.75} />
        <Area dataKey="completed" type="monotone" stroke="var(--color-completed)" fill="url(#rescueCompleted)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  )
}
