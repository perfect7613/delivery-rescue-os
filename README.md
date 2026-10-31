# Rescue — Delivery Rescue OS

An always-on agent for failed cash-on-delivery parcels.

When a courier fails to hand over a parcel in India, the order usually sits in an NDR (non-delivery report) queue until it goes back to the seller. Nobody calls the customer in time. The seller pays forward and return shipping, and the customer never gets the parcel. Rescue picks up each failed delivery as soon as it happens. It checks whether the customer can be contacted and phones them with a Bolna voice agent to ask which day they will be home. A reattempt is requested only after the customer clearly says yes. Every step is written to a Postgres ledger, so the work continues after a restart and you can audit it afterwards.

> Rescue runs on its own. Nobody presses a Run button. Closing the dashboard does not stop the worker.

**Built with:** [Bolna](https://www.bolna.ai) for the outbound voice agent · GLM 5.3 for planning · Supabase Postgres as the durable ledger · Next.js on Vercel · [Effect](https://effect.website) for the worker.

**Live desk:** https://delivery-rescue-os.vercel.app

---

## How a case moves

```
Detected ──▶ Plan ──▶ Call ──▶ Review ──▶ Rebook ──▶ Outcome
   │          │        │         │           │          │
 carrier   GLM 5.3   Bolna    policy or    carrier   verified
  NDR      proposes  voice    a person    reattempt  delivery
           next step  call    approves    requested  or return
```

| Stage | What happens |
| --- | --- |
| **Detected** | A carrier event (NDR) is deduplicated in `event_inbox` and opens a recovery case. |
| **Plan** | GLM 5.3 (`glm5.3-flash`, served through Sarvam's API) proposes the next step: call, stay silent, or hand to a person. It sees only the facts on the case and never sees the phone number. A policy layer accepts or rejects each proposal, and both outcomes are logged in `agent_decisions`. |
| **Call** | Bolna places one outbound call. The voice agent (Asha) asks whether the customer still wants the parcel, reads the chosen day back, and asks for an explicit yes. It never claims a booking was made. |
| **Review** | Unclear calls, timeouts, refusals or failed actions go to `HumanReview` with a reason. Approval policy is `auto`, `require_human` or `deny` per connector. |
| **Rebook** | The confirmed day is stored in case memory, and a reattempt is submitted through the carrier connector. A receipt is recorded. |
| **Outcome** | A separate signal confirms delivery. Completing the call is never treated as proof of delivery. |

Customers who opted out are never dialled. Already-delivered parcels are left alone.

## Architecture

```
apps/
  web/        Next.js 15 desk + API routes (Vercel)
  worker/     Resident worker entry (Effect layer)
packages/
  domain/     Pure reducer: (case, event) → phase + row writes. Unit-tested.
  harness/    Claim loop, leases, retries, planner/call/submit jobs
  connectors/ GLM 5.3 planner (via Sarvam), Bolna calls & execution reads, connector registry
  shared/     Event and proposal schemas, credential encryption
supabase/
  migrations/ Ledger schema, job claiming, public views
scripts/
  always-on.mjs       Supervisor that restarts the worker within one second
  configure-bolna.mjs Pushes the Asha prompt and call settings to your Bolna agent
```

**Durability.** Work lives in `workflow_jobs`. A worker claims a job with a 30-second lease (`claim_job`) and retries it up to five times. If a process dies, another process picks up the job once the lease expires. Each case carries a version number, so two workers can't both advance it.

**Waking the worker.** In production the desk and its API routes run on Vercel, with Postgres on Supabase. The worker is woken when someone opens the desk, when a new case arrives, and when a Bolna call finishes (via `/api/webhooks/bolna`). A daily Vercel cron calls `/api/worker` as a backstop. For continuous operation, run `npm run always-on` on any machine.

**Secrets.** Bolna and Sarvam keys stay in the server environment. They are never sent to the model or shown in the UI. Phone numbers are encrypted with `CREDENTIALS_KEY`, and the desk shows only a masked number.

## The desk

| Page | Purpose |
| --- | --- |
| **Overview** | Open cases, cash on delivery at stake, calls placed, cases that need a person, recent planner decisions, eight-day throughput |
| **Queue** | Open and recently closed cases, each drawn on its route line |
| **Shipment** | The full record of one case: call status, duration, cost, summary, recording, extracted answers, transcript, timeline, decisions, actions, workflow jobs |
| **Approvals** | Carrier actions that policy held for a person |
| **Agent** | Worker heartbeat. Pause or resume intake |
| **Integrations** | Connector status (Bolna, Sarvam, carriers). Read-only |
| **Outcomes** | Closed cases by result, labelled by source |

## Getting started

**Requirements:** Node 22+, a Supabase project, a Bolna account with an agent, and a Sarvam API key (for GLM 5.3).

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Supabase pooler URL (IPv4) for the `rescue_worker` role |
| `CREDENTIALS_KEY` | 32 random bytes, base64. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `WORKER_ID` | Unique per worker process |
| `BOLNA_API_KEY`, `BOLNA_AGENT_ID` | Your Bolna credentials and agent |
| `BOLNA_WEBHOOK_SECRET` | Checked against the `x-bolna-secret` header on webhook calls |
| `BOLNA_TEST_PHONE` | Number dialled for seeded cases |
| `SARVAM_API_KEY`, `SARVAM_BASE_URL` | Access to the GLM 5.3 planner (`glm5.3-flash`) |
| `DEMO_SIMULATOR` | Set to `0` to disable the simulator carrier routes |

Apply the migrations in `supabase/migrations/` in order. Then configure the voice agent and start both processes:

```bash
node scripts/configure-bolna.mjs   # once, pushes the Asha prompt to your Bolna agent
npm run always-on                  # resident worker, restarts itself if it exits
npm run dev:web                    # desk at http://localhost:3000
```

## Development

```bash
npm test          # domain reducer and connector tests
npm run typecheck # all workspaces
```

The core logic is a pure reducer in `packages/domain/src/reduce.ts`. Given a case snapshot and an event, it returns the next phase and the exact rows to write. The harness is the only code that touches the network or the database. This repository uses the [Effect](https://effect.website) library; see `AGENTS.md` before writing Effect code.

## Scope

- Calls go out for real through Bolna, and their transcripts, recordings and costs are stored.
- Reattempts go through the simulator carrier, and the desk labels them as simulated. Shiprocket is connected read-only, so Rescue never changes a live shipment.
- The outcome counts on the Outcomes page come from the simulator. They are not a measure of savings.

Supabase project: `delivery-rescue-os` in Mumbai (`ap-south-1`).
