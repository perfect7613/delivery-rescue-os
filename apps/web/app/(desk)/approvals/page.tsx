import Link from "next/link"
import { Setup } from "@/components/setup"
import { Empty, PageTitle, Panel, Tag } from "@/components/desk"
import { ago } from "@/lib/labels"
import { approvals, connected } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function ApprovalsPage() {
  if (!connected()) return <Setup />
  const rows = await approvals()
  return (
    <>
      <PageTitle
        kicker="Approvals"
        title={rows.length === 0 ? "Nothing is waiting on you." : <>{rows.length} held <em className="text-signal">for a person.</em></>}
        lede="Auto permission submits the simulated reattempt itself. This list is only what a person still has to release."
      />
      <Panel index={1} kicker="Held" title="Carrier actions" bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <Empty title="The tray is empty.">When policy holds an action, it lands here with the case it belongs to.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={String(row.id)} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="size-2 shrink-0 rounded-full bg-signal" aria-hidden />
                  <span className="ledger-ref truncate">{String(row.ref)}</span>
                  <span className="hidden font-mono text-[11px] text-faint sm:inline">held {ago(row.created_at)}</span>
                </div>
                <Tag tone="signal">{String(row.status)}</Tag>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {rows.length > 0 ? (
        <p className="text-[13px] text-mute">
          Open the case from the <Link href="/queue" className="underline underline-offset-4 hover:text-ink">queue</Link> to see the call
          and the decision behind each hold.
        </p>
      ) : null}
    </>
  )
}
