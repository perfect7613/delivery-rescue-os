import Link from "next/link"
import { Setup } from "@/components/setup"
import { Empty, PageTitle, Panel, PhaseTag, RouteLine } from "@/components/desk"
import { ago, rupees } from "@/lib/labels"
import { closedShipments, connected, queue } from "@/lib/queries"

export const dynamic = "force-dynamic"

function Ledger({ rows }: { rows: readonly Record<string, unknown>[] }) {
  return (
    <div role="table" aria-label="Recovery cases" className="text-[14px]">
      <div
        role="row"
        className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,1fr)_6rem_6rem] gap-6 border-b border-border px-5 py-2.5 md:grid"
      >
        {["Shipment", "Route", "Stage", "COD", "Updated"].map((name, index) => (
          <span key={name} role="columnheader" className={`kicker ${index >= 3 ? "text-right" : ""}`}>
            {name}
          </span>
        ))}
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => {
          const phase = String(row.phase)
          return (
            <Link
              key={String(row.id)}
              href={`/shipments/${row.shipment_id}`}
              role="row"
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-5 py-4 transition-colors hover:bg-paper/70 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,1fr)_6rem_6rem]"
            >
              <span role="cell" className="min-w-0">
                <span className="ledger-ref block truncate group-hover:underline group-hover:underline-offset-4">{String(row.ref)}</span>
                <span className="mt-0.5 block font-mono text-[10.5px] tracking-[0.06em] text-faint uppercase">
                  {String(row.current_carrier_status)}
                </span>
              </span>
              <span role="cell" className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
                <RouteLine phase={phase} size="sm" />
              </span>
              <span role="cell" className="justify-self-end md:justify-self-start">
                <PhaseTag phase={phase} />
              </span>
              <span role="cell" className="numeral hidden text-right text-[1.2rem] md:block">
                {rupees(Number(row.cod_amount_paise))}
              </span>
              <span role="cell" className="hidden text-right font-mono text-[11px] text-faint md:block">
                {ago(row.updated_at)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default async function QueuePage() {
  if (!connected()) return <Setup />
  const [rows, history] = await Promise.all([queue(), closedShipments()])
  const atStake = rows.reduce((sum, row) => sum + Number(row.cod_amount_paise), 0)
  return (
    <>
      <PageTitle
        kicker="Rescue queue"
        title={rows.length === 0 ? "The queue is clear." : <>{rows.length} open, <em className="text-mute">{rupees(atStake)} at stake.</em></>}
        lede="Every failed delivery the worker has picked up. Nothing here needs a Run button; cases advance on their own leases."
      />
      <Panel index={1} kicker="Open" title="Moving now" bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <Empty title="No open cases.">A new carrier failure lands here by itself and wakes the worker.</Empty>
          </div>
        ) : (
          <Ledger rows={rows} />
        )}
      </Panel>
      {history.length > 0 ? (
        <Panel
          index={2}
          kicker="Closed"
          title="Recently closed"
          note="Call records and transcripts stay available after a case closes. Showing the latest 50."
          bodyClassName="p-0"
        >
          <Ledger rows={history} />
        </Panel>
      ) : null}
    </>
  )
}
