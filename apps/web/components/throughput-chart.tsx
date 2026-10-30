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
  opened: { label: "Carrier events", color: "var(--chart-2)" },
  completed: { label: "Outcomes", color: "var(--chart-1)" },
} satisfies ChartConfig

export function ThroughputChart({
  data,
}: {
  data: { day: string; opened: number; completed: number }[]
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }} accessibilityLayer>
        <defs>
          <linearGradient id="rescueCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-completed)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-completed)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="opened"
          type="monotone"
          stroke="var(--color-opened)"
          strokeDasharray="4 4"
          fill="none"
          strokeWidth={2}
        />
        <Area
          dataKey="completed"
          type="monotone"
          stroke="var(--color-completed)"
          fill="url(#rescueCompleted)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
