"use client"

import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from "framer-motion"
import { useRef, type ComponentPropsWithoutRef, type ReactNode } from "react"
import { cn } from "../../lib/cn"

type MovingBorderButtonProps = {
  borderRadius?: string
  children: ReactNode
  containerClassName?: string
  borderClassName?: string
  duration?: number
  className?: string
} & ComponentPropsWithoutRef<"button">

export function MovingBorderButton({
  borderRadius = "999px",
  children,
  containerClassName,
  borderClassName,
  duration,
  className,
  ...otherProps
}: MovingBorderButtonProps) {
  return (
    <button
      className={cn("relative h-12 overflow-hidden bg-transparent p-px text-sm", containerClassName)}
      style={{ borderRadius }}
      {...otherProps}
    >
      <div className="absolute inset-0" style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}>
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <div
            className={cn(
              "h-16 w-16 bg-[radial-gradient(#e7a15a_40%,transparent_60%)] opacity-90",
              borderClassName,
            )}
          />
        </MovingBorder>
      </div>
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center border border-white/10 bg-[#101114]/90 px-5 text-[var(--paper)] antialiased backdrop-blur-xl",
          className,
        )}
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        {children}
      </div>
    </button>
  )
}

const MovingBorder = ({
  children,
  duration = 2800,
  rx,
  ry,
}: {
  children: ReactNode
  duration?: number
  rx?: string
  ry?: string
}) => {
  const pathRef = useRef<SVGRectElement>(null)
  const progress = useMotionValue(0)

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength()
    if (length) progress.set((time * (length / duration)) % length)
  })

  const x = useTransform(progress, (value) => pathRef.current?.getPointAtLength(value).x)
  const y = useTransform(progress, (value) => pathRef.current?.getPointAtLength(value).y)
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`

  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="absolute h-full w-full" width="100%" height="100%">
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div style={{ position: "absolute", top: 0, left: 0, display: "inline-block", transform }}>{children}</motion.div>
    </>
  )
}
