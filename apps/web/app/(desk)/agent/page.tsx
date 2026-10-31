import { Setup } from "@/components/setup"
import { PageTitle, Panel } from "@/components/desk"
import { ago } from "@/lib/labels"
import { agentMode, connected, workerLamp } from "@/lib/queries"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const modes = [
  { value: "running", name: "Running", copy: "New failures are picked up and worked as they arrive." },
  { value: "paused", name: "Pause intake", copy: "New failures wait at the door. A case already moving keeps its lease." },
]

export default async function AgentPage() {
  if (!connected()) return <Setup />
  const [mode, lamp] = await Promise.all([agentMode(), workerLamp()])
  const live = lamp !== null && lamp.ageSeconds < 20
  return (
    <>
      <PageTitle
        kicker="Agent"
        title={live ? <>On the floor.</> : <>Not heartbeating.</>}
        lede="The process is npm run always-on. It claims leased jobs from Postgres and resumes after a restart, so closing the desk never stops it."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel index={1} kicker="Worker" title="Heartbeat">
          <div className="flex items-center gap-4">
            <span className="lamp scale-150" data-on={live} aria-hidden />
            <div className="min-w-0">
              <p className="numeral text-[3rem] leading-none">{lamp ? `${lamp.ageSeconds}s` : "—"}</p>
              <p className="mt-1 text-[13px] text-mute">{lamp ? `since the last beat (${ago(lamp.lastSeenAt)})` : "No worker has reported yet."}</p>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div>
              <dt className="kicker">Worker id</dt>
              <dd className="mt-1.5 truncate font-mono text-[13px]">{lamp?.workerId ?? "none"}</dd>
            </div>
            <div>
              <dt className="kicker">Reported status</dt>
              <dd className="mt-1.5 font-mono text-[13px]">{lamp?.status ?? "none"}</dd>
            </div>
          </dl>
        </Panel>
        <Panel index={2} kicker="Intake" title="Mode" note="Switching mode is recorded on the organization and read by the worker on its next claim.">
          <form action="/api/agent" method="post" className="grid gap-3 sm:grid-cols-2">
            {modes.map((item) => {
              const on = item.value === mode
              return (
                <button
                  key={item.value}
                  name="mode"
                  value={item.value}
                  type="submit"
                  aria-pressed={on}
                  disabled={on}
                  className={cn(
                    "group flex flex-col items-start gap-2 rounded-xl p-4 text-left ring-1 transition-all",
                    on
                      ? "bg-ink text-paper ring-ink"
                      : "bg-paper ring-border hover:-translate-y-0.5 hover:ring-ink/40",
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="font-serif text-[1.35rem] leading-none">{item.name}</span>
                    <span className={cn("font-mono text-[10px] tracking-[0.12em] uppercase", on ? "text-paper/60" : "text-faint")}>
                      {on ? "Current" : "Switch"}
                    </span>
                  </span>
                  <span className={cn("text-[13px] leading-snug", on ? "text-paper/70" : "text-mute")}>{item.copy}</span>
                </button>
              )
            })}
          </form>
        </Panel>
      </div>
    </>
  )
}
