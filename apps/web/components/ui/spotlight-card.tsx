"use client"

import { motion, useMotionTemplate, useMotionValue } from "framer-motion"
import type { MouseEvent, ReactNode } from "react"
import { cn } from "../../lib/cn"

export function SpotlightCard({ className, children }: { className?: string; children: ReactNode }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const glow = useMotionTemplate`radial-gradient(340px circle at ${mouseX}px ${mouseY}px, rgba(231,161,90,0.14), transparent 55%)`
  const edge = useMotionTemplate`radial-gradient(260px circle at ${mouseX}px ${mouseY}px, rgba(244,241,234,0.55), transparent 62%)`

  const move = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    mouseX.set(event.clientX - bounds.left)
    mouseY.set(event.clientY - bounds.top)
  }

  return (
    <div onMouseMove={move} className={cn("group relative rounded-[22px] p-px", className)}>
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[22px] opacity-0 transition duration-300 group-hover:opacity-100"
        style={{ background: edge }}
      />
      <div className="relative h-full overflow-hidden rounded-[21px] border border-white/10 bg-[#101114]/75 p-5 backdrop-blur-md">
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
          style={{ background: glow }}
        />
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  )
}
