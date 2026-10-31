import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { phaseLabel, phaseStop, phaseTone, routeStops, type PhaseTone } from "@/lib/labels"

export function PageTitle({
  kicker,
  title,
  lede,
  action,
}: {
  kicker: string
  title: ReactNode
  lede?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="rise flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="kicker">{kicker}</p>
        <h2 className="mt-2 font-serif text-[2.6rem] leading-[1.02] tracking-[-0.025em] md:text-5xl">{title}</h2>
        {lede ? <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mute">{lede}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

export function Panel({
  kicker,
  title,
  note,
  action,
  children,
  className,
  bodyClassName,
  index = 0,
}: {
  kicker?: string
  title?: ReactNode
  note?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  index?: number
}) {
  const hasHead = kicker || title || note || action
  return (
    <section className={cn("panel rise min-w-0", className)} style={{ "--i": index } as CSSProperties}>
      {hasHead ? (
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 pt-4 pb-3.5">
          <div className="min-w-0">
            {kicker ? <p className="kicker">{kicker}</p> : null}
            {title ? <h3 className="mt-1 font-serif text-[1.45rem] leading-tight tracking-[-0.015em]">{title}</h3> : null}
            {note ? <p className="mt-1 text-[13px] leading-snug text-mute">{note}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-border bg-paper/60 px-4 py-5">
      <p className="font-serif text-lg leading-tight">{title}</p>
      {children ? <p className="text-[13px] leading-snug text-mute">{children}</p> : null}
    </div>
  )
}

const toneClass: Record<PhaseTone, string> = {
  moving: "bg-ink text-paper",
  signal: "bg-signal-soft text-signal ring-1 ring-signal/25",
  live: "bg-live-soft text-live ring-1 ring-live/25",
  quiet: "bg-paper-deep text-mute ring-1 ring-border",
}

export function PhaseTag({ phase, className }: { phase: string; className?: string }) {
  const tone = phaseTone(phase)
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 font-mono text-[10.5px] font-medium tracking-[0.06em] uppercase",
        toneClass[tone],
        className,
      )}
    >
      {tone === "signal" ? <span className="size-1.5 rounded-full bg-signal" aria-hidden /> : null}
      {phaseLabel(phase)}
    </span>
  )
}

export function Tag({ children, tone = "plain", className }: { children: ReactNode; tone?: "plain" | "signal" | "live" | "ink"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 font-mono text-[10.5px] font-medium tracking-[0.06em] uppercase",
        tone === "plain" && "bg-paper-deep text-mute ring-1 ring-border",
        tone === "signal" && "bg-signal-soft text-signal ring-1 ring-signal/25",
        tone === "live" && "bg-live-soft text-live ring-1 ring-live/25",
        tone === "ink" && "bg-ink text-paper",
        className,
      )}
    >
      {children}
    </span>
  )
}

/** A case drawn as a transit line. Stops behind it are filled, the current stop is ringed. */
export function RouteLine({ phase, size = "md", className }: { phase: string; size?: "sm" | "md"; className?: string }) {
  const here = phaseStop(phase)
  const tone = phaseTone(phase)
  const closed = tone === "live" || tone === "quiet"
  return (
    <div
      className={cn("route", className)}
      data-tone={tone}
      data-size={size}
      style={{ "--stops": routeStops.length } as CSSProperties}
      role="img"
      aria-label={`Stage ${here + 1} of ${routeStops.length}: ${phaseLabel(phase)}`}
    >
      {routeStops.map((stop, index) => (
        <div
          key={stop}
          className="route-stop"
          data-state={index < here || (closed && index === here) ? "done" : index === here ? "here" : "ahead"}
        >
          <span className="route-dot" />
          <span className="route-name">{index === here && closed ? phaseLabel(phase) : stop}</span>
        </div>
      ))}
    </div>
  )
}

export function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1.5 truncate text-[15px] text-ink">{children}</dd>
    </div>
  )
}
