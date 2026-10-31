alter table public.voice_calls
  add column if not exists provider_details jsonb not null default '{}'::jsonb,
  add column if not exists synced_at timestamptz;

comment on column public.voice_calls.provider_details is
  'Selected Bolna call metadata, summary, extraction results and provider-hosted recording reference. No credentials or phone numbers from telephony metadata.';
