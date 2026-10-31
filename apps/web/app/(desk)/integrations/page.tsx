import { Setup } from "@/components/setup"
import { PageTitle, Tag } from "@/components/desk"
import { phaseLabel } from "@/lib/labels"
import { connected, connections } from "@/lib/queries"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function IntegrationsPage() {
  if (!connected()) return <Setup />
  const rows = await connections()
  return (
    <>
      <PageTitle
        kicker="Integrations"
        title="What the agent can reach."
        lede="Bolna and Sarvam keys stay in the server env. They are never sent to the model and never rendered here. Shiprocket is listed and read-only. Coming-soon entries cannot be activated."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row, index) => {
          const live = Boolean(row.active)
          const name = phaseLabel(String(row.connector_id))
          return (
            <section
              key={String(row.connector_id)}
              className={cn("panel rise flex flex-col gap-6 p-5", !live && "bg-white/60")}
              style={{ "--i": index + 1 } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-xl font-serif text-[1.4rem]",
                    live ? "bg-ink text-paper" : "bg-paper-deep text-mute",
                  )}
                  aria-hidden
                >
                  {name.charAt(0).toUpperCase()}
                </span>
                <Tag tone={live ? "live" : "plain"}>{live ? "Active" : "Inactive"}</Tag>
              </div>
              <div>
                <h3 className="font-serif text-[1.5rem] leading-tight capitalize">{name}</h3>
                <p className="mt-1 font-mono text-[11px] tracking-[0.06em] text-faint uppercase">
                  {String(row.kind)} · {phaseLabel(String(row.availability))}
                </p>
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
