"use client"

import { motion, useSpring, useTransform, type SpringOptions } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "../../lib/cn"

type SpotlightProps = {
  className?: string
  size?: number
  springOptions?: SpringOptions
}

export function Spotlight({ className, size = 200, springOptions = { bounce: 0 } }: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [parentElement, setParentElement] = useState<HTMLElement | null>(null)
  const mouseX = useSpring(0, springOptions)
  const mouseY = useSpring(0, springOptions)
  const spotlightLeft = useTransform(mouseX, (x) => `${x - size / 2}px`)
  const spotlightTop = useTransform(mouseY, (y) => `${y - size / 2}px`)

  useEffect(() => {
    const parent = containerRef.current?.parentElement
    const root = containerRef.current?.closest("[data-spotlight-root]")
    if (parent) {
      parent.style.position = "relative"
      parent.style.overflow = "hidden"
    }
    if (root instanceof HTMLElement) setParentElement(root)
  }, [])

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!parentElement) return
      const { left, top } = parentElement.getBoundingClientRect()
      mouseX.set(event.clientX - left)
      mouseY.set(event.clientY - top)
    },
    [mouseX, mouseY, parentElement],
  )

  useEffect(() => {
    if (!parentElement) return
    const enter = () => setIsHovered(true)
    const leave = () => setIsHovered(false)
    parentElement.addEventListener("mousemove", handleMouseMove)
    parentElement.addEventListener("mouseenter", enter)
    parentElement.addEventListener("mouseleave", leave)
    return () => {
      parentElement.removeEventListener("mousemove", handleMouseMove)
      parentElement.removeEventListener("mouseenter", enter)
      parentElement.removeEventListener("mouseleave", leave)
    }
  }, [parentElement, handleMouseMove])

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "pointer-events-none absolute rounded-full bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops),transparent_80%)] blur-2xl transition-opacity duration-300",
        "from-zinc-50 via-zinc-100 to-zinc-200",
        isHovered ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{ width: size, height: size, left: spotlightLeft, top: spotlightTop }}
    />
  )
}
