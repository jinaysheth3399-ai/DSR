-- DSR — initial schema
-- Conventions: every table has id uuid pk, created_at, and (where it makes sense) updated_at.
-- RLS is enabled on every table without policies, so anon and authenticated roles
-- get default-deny. Server Actions use the service role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  phone         text not null unique,
  employee_code text not null unique,
  role          text not null default 'field_sales' check (role in ('field_sales', 'admin')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint employees_phone_e164 check (phone ~ '^\+91[6-9][0-9]{9}$')
);

create index employees_active_phone_idx on public.employees (phone) where is_active = true;

create trigger employees_set_updated_at
before update on public.employees
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- otp_requests
-- ---------------------------------------------------------------------------
create table public.otp_requests (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  otp_hash      text not null,
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  attempt_count int not null default 0 check (attempt_count >= 0),
  created_at    timestamptz not null default now(),
  constraint otp_requests_phone_e164 check (phone ~ '^\+91[6-9][0-9]{9}$')
);

create index otp_requests_phone_created_idx on public.otp_requests (phone, created_at desc);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  token_hash    text not null unique,
  user_agent    text,
  ip            text,
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index sessions_employee_id_idx on public.sessions (employee_id);

-- ---------------------------------------------------------------------------
-- dsr_submissions
-- ---------------------------------------------------------------------------
-- TODO(open-item): plan §5 introduces submitted_by_name_snapshot / employee_code_snapshot
-- so historical rows survive employee hard-delete via on-delete-set-null. Held until
-- Jinay confirms; current FK is implicit RESTRICT (delete fails if submissions exist).
create table public.dsr_submissions (
  id            uuid primary key default gen_random_uuid(),
  submitted_by  uuid not null references public.employees(id),
  visit_date    date not null,

  -- HEADER
  agent_type    text not null check (agent_type in ('registered', 'new')),
  agency_code   text,
  agency_name   text,

  -- FLIGHT
  flight_escalation_has_ref       boolean not null,
  flight_escalation_booking_id    text,
  flight_monthly_txn_lakhs        numeric(10,2) not null check (flight_monthly_txn_lakhs >= 0),
  flight_domestic_portals         text[] not null,
  flight_international_portals    text[] not null,
  flight_issue_complaint          text[] not null,
  flight_agent_mode               text not null check (flight_agent_mode in ('Offline', 'Online', 'Both')),
  flight_dealing_type             text not null check (flight_dealing_type in ('Direct', 'Distributor')),
  flight_client_type              text not null check (flight_client_type in ('Corporate', 'Direct customer')),
  flight_payment_mode             text not null check (flight_payment_mode in ('Cash', 'Credit', 'Bank transfer')),
  flight_credit_type              text check (flight_credit_type in ('3 days', 'Weekly', 'BSP')),

  -- HOTEL
  hotel_escalation_has_ref        boolean not null,
  hotel_escalation_booking_id     text,
  hotel_monthly_room_nights_lakhs numeric(10,2) not null check (hotel_monthly_room_nights_lakhs >= 0),
  hotel_current_room_nights_etrav numeric(10,0) not null check (hotel_current_room_nights_etrav >= 0),
  hotel_primary_platform          text[] not null,
  hotel_committed_room_nights     numeric(10,0) not null check (hotel_committed_room_nights >= 0),
  hotel_category_preference       text[] not null check (hotel_category_preference <@ array['Budget','3*','4*','5*']),
  hotel_issue_complaint           text,

  -- DMC
  dmc_escalation_has_ref          boolean not null,
  dmc_escalation_booking_id       text,
  dmc_destination_discussed       text[] not null,
  dmc_agent_active                boolean not null,
  dmc_current_vendor              text not null,
  dmc_current_vendor_pax          numeric(10,0) not null check (dmc_current_vendor_pax >= 0),
  dmc_lead_interest               boolean not null,
  dmc_committed_pax               numeric(10,0) not null check (dmc_committed_pax >= 0),
  dmc_objection                   text[] not null,

  -- VISIT CLOSE
  visit_outcome     text not null check (visit_outcome in ('Positive', 'Neutral', 'Negative')),
  visit_commitment  text not null,
  visit_escalation  text[] not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agency_xor check (
    (agent_type = 'registered' and agency_code is not null and agency_name is null)
    or
    (agent_type = 'new' and agency_name is not null and agency_code is null)
  ),
  constraint flight_credit_xor check (
    (flight_payment_mode = 'Credit' and flight_credit_type is not null)
    or
    (flight_payment_mode <> 'Credit' and flight_credit_type is null)
  ),
  constraint flight_escalation_xor check (
    (flight_escalation_has_ref and flight_escalation_booking_id is not null)
    or
    (not flight_escalation_has_ref and flight_escalation_booking_id is null)
  ),
  constraint hotel_escalation_xor check (
    (hotel_escalation_has_ref and hotel_escalation_booking_id is not null)
    or
    (not hotel_escalation_has_ref and hotel_escalation_booking_id is null)
  ),
  constraint dmc_escalation_xor check (
    (dmc_escalation_has_ref and dmc_escalation_booking_id is not null)
    or
    (not dmc_escalation_has_ref and dmc_escalation_booking_id is null)
  ),
  constraint flight_domestic_portals_nonempty      check (cardinality(flight_domestic_portals)      > 0),
  constraint flight_international_portals_nonempty check (cardinality(flight_international_portals) > 0),
  constraint hotel_primary_platform_nonempty       check (cardinality(hotel_primary_platform)       > 0),
  constraint hotel_category_preference_nonempty    check (cardinality(hotel_category_preference)    > 0),
  constraint dmc_destination_discussed_nonempty    check (cardinality(dmc_destination_discussed)    > 0)
);

create index dsr_submissions_submitted_by_idx on public.dsr_submissions (submitted_by);
create index dsr_submissions_visit_date_idx   on public.dsr_submissions (visit_date desc);
create index dsr_submissions_agency_code_idx  on public.dsr_submissions (agency_code);

create trigger dsr_submissions_set_updated_at
before update on public.dsr_submissions
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- dsr_drafts (one per employee, overwritten each save)
-- ---------------------------------------------------------------------------
create table public.dsr_drafts (
  employee_id  uuid primary key references public.employees(id) on delete cascade,
  payload      jsonb not null,
  current_step text not null check (current_step in ('header', 'flight', 'hotel', 'dmc', 'close')),
  updated_at   timestamptz not null default now()
);

create trigger dsr_drafts_set_updated_at
before update on public.dsr_drafts
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- placeholder_options
-- ---------------------------------------------------------------------------
create table public.placeholder_options (
  id         uuid primary key default gen_random_uuid(),
  field_key  text not null,
  label      text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index placeholder_options_field_label_uq
  on public.placeholder_options (field_key, label);

create index placeholder_options_field_active_sort_idx
  on public.placeholder_options (field_key, sort_order) where is_active = true;

-- ---------------------------------------------------------------------------
-- Row Level Security — enable on every table, no policies.
-- Effect: anon & authenticated roles get blanket deny. service_role bypasses RLS.
-- All app reads/writes go through Server Actions using the service role key.
-- ---------------------------------------------------------------------------
alter table public.employees           enable row level security;
alter table public.otp_requests        enable row level security;
alter table public.sessions            enable row level security;
alter table public.dsr_submissions     enable row level security;
alter table public.dsr_drafts          enable row level security;
alter table public.placeholder_options enable row level security;
