import { Setup } from "@/components/setup"
import { Empty, PageTitle, Panel, Tag } from "@/components/desk"
import { db } from "@/lib/db"
import { phaseLabel } from "@/lib/labels"
import { connected } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  if (!connected()) return <Setup />
  const rows = await db()`
    select source, result, count(*)::int as count
    from outcomes
    group by source, result
  `
  const total = rows.reduce((sum, row) => sum + Number(row.count), 0)
  return (
    <>
      <PageTitle
        kicker="Outcomes"
        title="How cases closed."
        lede="These counts come from the simulator. They show how the ledger separates a Bolna call from a pretend delivery. They are not savings."
      />
      <Panel index={1} kicker="By result" title={`${total} recorded`} note="Every row is labelled with where the outcome came from.">
        {rows.length === 0 ? (
          <Empty title="No outcomes yet." />
        ) : (
          <ul className="space-y-5">
            {rows.map((row, index) => {
              const count = Number(row.count)
              const share = total ? Math.round((count / total) * 100) : 0
              const simulated = String(row.source) === "simulated"
              return (
                <li key={index}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-3">
                      <span className="numeral text-[2.2rem] leading-none">{count}</span>
                      <span className="text-[15px] capitalize">{phaseLabel(String(row.result))}</span>
                    </div>
                    <Tag tone={simulated ? "plain" : "live"}>{simulated ? "Synthetic" : "Live"}</Tag>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-deep" aria-hidden>
                    <div
                      className={simulated ? "h-full rounded-full bg-ink/70" : "h-full rounded-full bg-live"}
                      style={{ width: `${share}%`, backgroundImage: simulated ? "repeating-linear-gradient(135deg, transparent 0 4px, rgba(255,255,255,.35) 4px 6px)" : undefined }}
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-[10.5px] tracking-[0.06em] text-faint uppercase">
                    {share}% · {String(row.source)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}
