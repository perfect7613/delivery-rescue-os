import type { ReactNode } from "react"

export function PageHeader({
  kicker,
  title,
  lede,
  action,
}: {
  kicker: string
  title: string
  lede?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="text-[11px] tracking-[0.36em] text-[var(--mute)]">{kicker}</p>
        <h2 className="display mt-3 text-5xl leading-[0.95] tracking-tight md:text-6xl">{title}</h2>
        {lede ? <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--mute)]">{lede}</p> : null}
      </div>
      {action}
    </header>
  )
}
