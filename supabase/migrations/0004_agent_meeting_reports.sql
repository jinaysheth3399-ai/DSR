-- 0004_agent_meeting_reports.sql — standalone meeting-report form, currently
-- restricted (in application code) to a single employee: Karan Makdani
-- (employee_code EC052). Separate from dsr_submissions by design.

create table public.agent_meeting_reports (
  id                       uuid primary key default gen_random_uuid(),
  submitted_by             uuid not null references public.employees(id),
  visit_date               date not null,

  travel_agent_name        text not null,
  agent_code                text not null,
  city                      text not null,
  business_aspect           text not null,
  current_challenges        text not null,
  meeting_summary           text not null,
  potential_queries         text not null,
  destinations_interested   text[] not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agent_meeting_reports_destinations_nonempty
    check (cardinality(destinations_interested) > 0)
);

create index agent_meeting_reports_submitted_by_idx on public.agent_meeting_reports (submitted_by);
create index agent_meeting_reports_visit_date_idx   on public.agent_meeting_reports (visit_date desc);

create trigger agent_meeting_reports_set_updated_at
before update on public.agent_meeting_reports
for each row execute procedure public.set_updated_at();

alter table public.agent_meeting_reports enable row level security;
