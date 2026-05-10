create extension if not exists "pgcrypto";

create type pet_policy as enum (
  'not_allowed',
  'cats_only',
  'dogs_only',
  'cats_and_dogs',
  'caged_pets_only',
  'unknown'
);

create type access_information_policy as enum ('transfer_only', 'disabled');

create table clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'America/Chicago',
  manager_emails text[] not null default '{}',
  owner_notification_emails text[] not null default '{}',
  transfer_phone_number text not null,
  default_showing_duration_minutes int not null default 30,
  default_showing_buffer_minutes int not null default 15,
  application_url text not null,
  access_information_policy access_information_policy not null default 'transfer_only',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text,
  street_number text not null,
  street_name text not null,
  city text not null,
  state text not null default 'TX',
  beds numeric(4, 1),
  baths numeric(4, 1),
  monthly_rent_cents int not null check (monthly_rent_cents > 0),
  pet_policy pet_policy not null default 'unknown',
  stories int,
  available_date text,
  application_url text,
  calendar_id text,
  showing_instructions text,
  access_information_allowed boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_client_active_idx on properties(client_id, active);
create index properties_address_idx on properties(client_id, street_number, street_name, city);

create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  google_account_email text not null,
  calendar_id text not null,
  encrypted_refresh_token text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table calls (
  id text primary key,
  client_id uuid references clients(id) on delete set null,
  twilio_call_sid text,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null,
  property_id uuid references properties(id) on delete set null,
  lead jsonb not null default '{}',
  qualification jsonb,
  compliance_events jsonb not null default '[]',
  transcript jsonb not null default '[]',
  summary text,
  outcome text,
  updated_at timestamptz not null default now()
);

create index calls_client_started_idx on calls(client_id, started_at desc);
create index calls_twilio_sid_idx on calls(twilio_call_sid);

create table call_events (
  id uuid primary key default gen_random_uuid(),
  call_id text not null references calls(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table call_audio_files (
  id uuid primary key default gen_random_uuid(),
  call_id text not null references calls(id) on delete cascade,
  kind text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size int not null default 0,
  created_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  call_id text not null references calls(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  caller_name text,
  caller_phone text,
  desired_move_in_date text,
  desired_length_of_stay text,
  captured_fields jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table qualifications (
  id uuid primary key default gen_random_uuid(),
  call_id text not null references calls(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  adult_count int,
  credit_over_600 boolean,
  credit_average int,
  income_threshold_cents int,
  income_meets_3x_rent boolean,
  wants_cosigner boolean,
  wants_increased_deposit boolean,
  qualified_to_apply text,
  created_at timestamptz not null default now()
);

create table showings (
  id uuid primary key default gen_random_uuid(),
  call_id text not null references calls(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  calendar_event_id text,
  start_at timestamptz,
  end_at timestamptz,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);

create table emails (
  id uuid primary key default gen_random_uuid(),
  call_id text not null references calls(id) on delete cascade,
  resend_email_id text,
  recipients text[] not null default '{}',
  subject text not null,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table miro_exports (
  id uuid primary key default gen_random_uuid(),
  call_id text not null references calls(id) on delete cascade,
  board_id text not null,
  item_id text,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id text,
  action text not null,
  target_type text not null,
  target_id text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table clients enable row level security;
alter table properties enable row level security;
alter table calendar_connections enable row level security;
alter table calls enable row level security;
alter table call_events enable row level security;
alter table call_audio_files enable row level security;
alter table leads enable row level security;
alter table qualifications enable row level security;
alter table showings enable row level security;
alter table emails enable row level security;
alter table miro_exports enable row level security;
alter table audit_logs enable row level security;

create policy "service role full access clients" on clients for all to service_role using (true) with check (true);
create policy "service role full access properties" on properties for all to service_role using (true) with check (true);
create policy "service role full access calendar_connections" on calendar_connections for all to service_role using (true) with check (true);
create policy "service role full access calls" on calls for all to service_role using (true) with check (true);
create policy "service role full access call_events" on call_events for all to service_role using (true) with check (true);
create policy "service role full access call_audio_files" on call_audio_files for all to service_role using (true) with check (true);
create policy "service role full access leads" on leads for all to service_role using (true) with check (true);
create policy "service role full access qualifications" on qualifications for all to service_role using (true) with check (true);
create policy "service role full access showings" on showings for all to service_role using (true) with check (true);
create policy "service role full access emails" on emails for all to service_role using (true) with check (true);
create policy "service role full access miro_exports" on miro_exports for all to service_role using (true) with check (true);
create policy "service role full access audit_logs" on audit_logs for all to service_role using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('call-artifacts', 'call-artifacts', false)
on conflict (id) do nothing;
