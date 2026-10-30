# Delivery Rescue OS

Always-on recovery operator for failed deliveries. One Node process claims leased jobs from Supabase. Closing the dashboard does not stop it.

## Run

```bash
npm install
cp .env.example .env
```

Paste `BOLNA_API_KEY`, `BOLNA_AGENT_ID`, `BOLNA_TEST_PHONE`, and `SARVAM_API_KEY` into `.env`. The file is gitignored.

```bash
npm run always-on
npm run dev:web
```

`npm run always-on` is the resident supervisor. If the worker process exits, it starts again after one second. A new process claims any job whose lease has expired. Cases stay in Postgres, not in a model session.

Open http://localhost:3000 and seed the ₹1,499 failure from the queue. The worker picks it up without a Run button.

## Supabase

Project `delivery-rescue-os` in Mumbai (`ap-south-1`): `https://mstmxyxmsztfgaakwdgg.supabase.co`

The ledger migration is `supabase/migrations/0001_ledger.sql`.
