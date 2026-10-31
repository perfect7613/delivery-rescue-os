import { PageTitle, Panel } from "@/components/desk"

const steps = [
  ["Copy the template", "cp .env.example .env"],
  ["Paste your keys", "BOLNA_API_KEY, BOLNA_AGENT_ID, SARVAM_API_KEY"],
  ["Start the worker", "npm run always-on"],
]

export function Setup() {
  return (
    <>
      <PageTitle
        kicker="Setup"
        title={<>The desk is waiting on <span className="ledger-ref">.env</span></>}
        lede="Paste your Bolna and Sarvam keys there. DATABASE_URL is filled for the Supabase project when the worker role is created."
      />
      <Panel index={1} className="max-w-2xl" bodyClassName="p-0">
        <ol className="divide-y divide-border">
          {steps.map(([name, command], index) => (
            <li key={name} className="flex items-center gap-4 px-5 py-4">
              <span className="numeral w-6 text-[1.6rem] leading-none text-faint">{index + 1}</span>
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{name}</p>
                <code className="mt-1 block truncate font-mono text-[12px] text-mute">{command}</code>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  )
}
