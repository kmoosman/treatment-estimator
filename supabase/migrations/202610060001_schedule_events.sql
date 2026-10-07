-- Event documents contain private edit-token hashes as well as shared responses.
-- Access them only through the scheduling API, which requires an event link.
create table public.schedule_events (
  id uuid primary key,
  document jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_events_document_object check (jsonb_typeof(document) = 'object'),
  constraint schedule_events_document_size check (octet_length(document::text) <= 8388608),
  constraint schedule_events_document_id check (
    document ->> 'id' is not null and document ->> 'id' = id::text
  )
);

alter table public.schedule_events enable row level security;
alter table public.schedule_events force row level security;

-- Supabase grants may otherwise make new public-schema tables API-readable.
revoke all on table public.schedule_events from public, anon, authenticated;
grant select, insert, update, delete on table public.schedule_events to service_role;

-- Deliberately no anon/authenticated policies: browser clients cannot enumerate
-- events, read private document fields, or bypass the server's editing workflow.
comment on table public.schedule_events is
  'Private scheduling documents; server service_role access only. Version guards concurrent edits.';

notify pgrst, 'reload schema';
