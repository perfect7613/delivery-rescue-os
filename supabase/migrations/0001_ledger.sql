-- Delivery Rescue OS ledger. One journal. The worker is the only phase writer.

create table organizations (
  id uuid primary key,
  name text not null,
  agent_mode text not null check (agent_mode in ('running', 'paused')),
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  auth_user_id uuid unique,
  email text
);

create table provider_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  connector_id text not null,
  kind text not null check (kind in ('logistics', 'commerce', 'voice', 'ai', 'notifications')),
  availability text not null check (availability in ('ready', 'coming_soon')),
  active boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  credentials_ciphertext text,
  created_at timestamptz not null default now(),
  unique (org_id, connector_id)
);

create unique index one_active_logistics
  on provider_connections (org_id)
  where active and kind = 'logistics';

create table shipments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  ref text not null,
  contact_policy text not null check (contact_policy in ('ok_to_call', 'opted_out')),
  cod_amount_paise integer not null check (cod_amount_paise >= 0),
  phone_ciphertext text,
  phone_mask text,
  current_carrier_status text not null check (
    current_carrier_status in ('created', 'ndr', 'reattempt_submitted', 'delivered', 'returned')
  ),
  created_at timestamptz not null default now(),
  unique (org_id, ref)
);

create table shipment_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  shipment_id uuid not null references shipments (id),
  dedup_key text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  unique (org_id, dedup_key)
);

create table recovery_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  shipment_id uuid not null references shipments (id),
  phase text not null check (phase in (
    'Detected', 'Evaluating', 'AwaitingCustomer', 'BolnaCall', 'AwaitingApproval',
    'HumanReview', 'ActionSubmitted', 'AwaitingCarrierOutcome',
    'Delivered', 'Returned', 'Unresolved'
  )),
  review_reason text,
  version integer not null default 0,
  open boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint review_reason_matches_phase check (
    (
      phase in ('HumanReview', 'Unresolved')
      and review_reason is not null
    )
    or (
      phase not in ('HumanReview', 'Unresolved')
      and review_reason is null
    )
  )
);

create unique index one_open_case on recovery_cases (shipment_id) where open;

create table case_memory (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  case_id uuid not null references recovery_cases (id),
  dedup_key text not null,
  availability text not null,
  reattempt_day text,
  created_at timestamptz not null default now(),
  unique (org_id, dedup_key)
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  case_id uuid not null references recovery_cases (id),
  idempotency_key text not null,
  status text not null check (status in ('running', 'decoded', 'rejected')),
  raw_output text,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create table agent_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  case_id uuid not null references recovery_cases (id),
  proposal_tag text not null,
  policy_tag text not null check (policy_tag in ('accepted', 'rejected')),
  evidence_ids jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table voice_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  case_id uuid not null references recovery_cases (id),
  idempotency_key text not null,
  status text not null check (status in ('placing', 'in_flight', 'completed')),
  execution_id text,
  duration_ms integer,
  cost_paise integer,
  transcript text,
  extraction jsonb,
  unique (org_id, idempotency_key)
);

create table action_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  case_id uuid not null references recovery_cases (id),
  status text not null check (status in ('pending', 'policy_granted', 'human_granted', 'denied')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create table action_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  case_id uuid not null references recovery_cases (id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create table workflow_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  dedup_key text not null,
  status text not null check (status in ('pending', 'running', 'succeeded', 'cancelled', 'dead')),
  payload jsonb not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  lease_expires_at timestamptz,
  next_run_at timestamptz not null default now(),
  claimed_by text,
  resolution text,
  updated_at timestamptz not null default now(),
  unique (org_id, dedup_key)
);

create index workflow_jobs_claim on workflow_jobs (next_run_at, id)
  where status in ('pending', 'running');

create table workflow_waits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  case_id uuid not null references recovery_cases (id),
  wait_key text not null,
  status text not null check (status in ('waiting', 'satisfied', 'cancelled')),
  deadline_at timestamptz not null,
  unique (org_id, wait_key)
);

create table event_inbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  shipment_id uuid references shipments (id),
  dedup_key text not null,
  source text not null,
  payload jsonb not null,
  apply_status text not null check (apply_status in ('pending', 'applied', 'rejected')),
  created_at timestamptz not null default now(),
  unique (org_id, dedup_key)
);

create table event_outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  case_id uuid references recovery_cases (id),
  dedup_key text not null,
  status text not null check (status in ('pending', 'sent')),
  created_at timestamptz not null default now(),
  unique (org_id, dedup_key)
);

create table outcomes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  case_id uuid not null references recovery_cases (id),
  source text not null check (source in ('simulated', 'live')),
  result text not null check (result in ('delivered', 'returned')),
  created_at timestamptz not null default now(),
  unique (case_id)
);

create table worker_status (
  worker_id text primary key,
  status text not null check (status in ('running', 'idle')),
  last_seen_at timestamptz not null,
  booted_at timestamptz not null,
  last_job_dedup text
);

create or replace function accept_event(
  p_org_id uuid,
  p_dedup_key text,
  p_source text,
  p_payload jsonb,
  p_shipment_id uuid
) returns uuid
language plpgsql
as $$
declare
  inbox_id uuid;
begin
  insert into event_inbox (org_id, dedup_key, source, payload, shipment_id, apply_status)
  values (p_org_id, p_dedup_key, p_source, p_payload, p_shipment_id, 'pending')
  on conflict (org_id, dedup_key) do nothing
  returning id into inbox_id;

  if inbox_id is null then
    return null;
  end if;

  insert into workflow_jobs (org_id, dedup_key, status, payload, next_run_at)
  values (
    p_org_id,
    'apply:' || p_dedup_key,
    'pending',
    jsonb_build_object('_tag', 'ApplyEvent', 'inboxId', inbox_id),
    now()
  )
  on conflict (org_id, dedup_key) do nothing;

  return inbox_id;
end;
$$;

create or replace function claim_job(p_worker_id text)
returns setof workflow_jobs
language plpgsql
as $$
begin
  return query
  with candidate as (
    select id
    from workflow_jobs
    where status in ('pending', 'running')
      and next_run_at <= now()
      and (lease_expires_at is null or lease_expires_at < now())
      and attempt_count < max_attempts
    order by next_run_at, id
    for update skip locked
    limit 1
  )
  update workflow_jobs j
  set status = 'running',
      claimed_by = p_worker_id,
      lease_expires_at = now() + interval '30 seconds',
      attempt_count = j.attempt_count + 1,
      updated_at = now()
  from candidate c
  where j.id = c.id
  returning j.*;
end;
$$;

create or replace function seed_demo_case(
  p_org_id uuid,
  p_ref text,
  p_contact text,
  p_carrier text,
  p_cod integer,
  p_phone_cipher text,
  p_phone_mask text
) returns uuid
language plpgsql
as $$
declare
  shipment_id uuid;
  dedup text := 'sim:' || p_ref || ':ndr_created';
begin
  insert into shipments (
    org_id, ref, contact_policy, cod_amount_paise, phone_ciphertext, phone_mask, current_carrier_status
  ) values (
    p_org_id, p_ref, p_contact, p_cod, p_phone_cipher, p_phone_mask, p_carrier
  )
  on conflict (org_id, ref) do update
    set contact_policy = excluded.contact_policy
  returning id into shipment_id;

  perform accept_event(
    p_org_id,
    dedup,
    'demo-carrier',
    jsonb_build_object('_tag', 'NdrCreated', 'dedupKey', dedup, 'shipmentId', shipment_id),
    shipment_id
  );

  return shipment_id;
end;
$$;

create or replace function advance_demo(p_org_id uuid, p_ref text, p_result text)
returns uuid
language plpgsql
as $$
declare
  shipment_id uuid;
  dedup text;
begin
  select id into shipment_id from shipments where org_id = p_org_id and ref = p_ref;
  if shipment_id is null then
    raise exception 'unknown shipment';
  end if;
  dedup := 'sim:' || p_ref || ':' || p_result;
  return accept_event(
    p_org_id,
    dedup,
    'demo-carrier',
    jsonb_build_object('_tag', 'CarrierAdvanced', 'dedupKey', dedup, 'result', p_result),
    shipment_id
  );
end;
$$;

insert into organizations (id, name, agent_mode)
values ('00000000-0000-4000-8000-000000000001', 'Demo Merchant', 'running');

insert into provider_connections (org_id, connector_id, kind, availability, active, permissions)
values
  ('00000000-0000-4000-8000-000000000001', 'demo-carrier', 'logistics', 'ready', true, '{"simulatedReattempt":"auto"}'),
  ('00000000-0000-4000-8000-000000000001', 'shiprocket', 'logistics', 'ready', false, '{"simulatedReattempt":"deny"}'),
  ('00000000-0000-4000-8000-000000000001', 'bolna', 'voice', 'ready', true, '{"placeCall":"auto"}'),
  ('00000000-0000-4000-8000-000000000001', 'sarvam', 'ai', 'ready', true, '{}'),
  ('00000000-0000-4000-8000-000000000001', 'whatsapp', 'notifications', 'coming_soon', false, '{}'),
  ('00000000-0000-4000-8000-000000000001', 'email', 'notifications', 'coming_soon', false, '{}'),
  ('00000000-0000-4000-8000-000000000001', 'commerce_store', 'commerce', 'coming_soon', false, '{}');

alter table organizations enable row level security;
alter table users enable row level security;
alter table provider_connections enable row level security;
alter table shipments enable row level security;
alter table shipment_events enable row level security;
alter table recovery_cases enable row level security;
alter table case_memory enable row level security;
alter table agent_runs enable row level security;
alter table agent_decisions enable row level security;
alter table voice_calls enable row level security;
alter table action_approvals enable row level security;
alter table action_receipts enable row level security;
alter table workflow_jobs enable row level security;
alter table workflow_waits enable row level security;
alter table event_inbox enable row level security;
alter table event_outbox enable row level security;
alter table outcomes enable row level security;
alter table worker_status enable row level security;

revoke all on all tables in schema public from anon, authenticated;

create view recovery_cases_public as
  select id, org_id, shipment_id, phase, review_reason, version, open, updated_at
  from recovery_cases;

create view shipments_public as
  select id, org_id, ref, contact_policy, cod_amount_paise, phone_mask, current_carrier_status, created_at
  from shipments;

create view worker_status_public as
  select worker_id, status, last_seen_at, booted_at, last_job_dedup
  from worker_status;

grant select on recovery_cases_public, shipments_public, worker_status_public to anon, authenticated;
