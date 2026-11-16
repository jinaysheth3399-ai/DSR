-- Database-side paging and change detection for the outward visits API
-- (lib/api/visits.ts).
--
-- 1. api_visit_keys: one row per visit across dsr_submissions and
--    agent_meeting_reports, with only the columns the API sorts and filters
--    on. The API asks it for one page of (id, source) keys in final order plus
--    the exact total, in a single request; Postgres merges the two tables'
--    indexes and skips to the offset itself (about 6 ms for the deepest page).
--    Previously the app fetched every key up to the requested depth, 1000 at
--    a time, and merged them in JavaScript, so a client paging through
--    everything cost more per page the deeper it went, and nothing past
--    20,000 rows per table could be reached at all.
--
--    Columns that exist on only one table are null on the other, so the
--    outcome and lead filters exclude agent meetings automatically, exactly as
--    before. agency_a / agency_b are the two text columns the `agency` search
--    matches on each table.
--
-- 2. api_visits_version(): a fingerprint of everything an API response is
--    built from (visits, meetings, and the employee names attached to them).
--    The API keeps a copy of each response and reuses it while the
--    fingerprint is unchanged. Count plus the sum of updated_at changes on
--    every insert, delete and edit (the set_updated_at triggers stamp each
--    edit), including edits that commit out of order, which max(updated_at)
--    alone would miss.
--
-- Security: RLS is enabled with no policies on both base tables, and
-- security_invoker makes the view apply the caller's RLS, so the public anon
-- and authenticated roles see nothing. Grants are revoked as well so the view
-- and function are not even listed for them. The app uses service_role.

create or replace view public.api_visit_keys
with (security_invoker = true)
as
  select
    id,
    'dsr'::text as source,
    visit_date,
    created_at,
    updated_at,
    submitted_by,
    visit_outcome,
    dmc_lead_interest,
    agency_code as agency_a,
    agency_name as agency_b
  from public.dsr_submissions
  union all
  select
    id,
    'agent_meeting'::text,
    visit_date,
    created_at,
    updated_at,
    submitted_by,
    null::text,
    null::boolean,
    travel_agent_name,
    agent_code
  from public.agent_meeting_reports;

revoke all on public.api_visit_keys from public, anon, authenticated;
grant select on public.api_visit_keys to service_role;

create or replace function public.api_visits_version()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select concat_ws('|',
    (select count(*) from public.dsr_submissions),
    (select sum(extract(epoch from updated_at)) from public.dsr_submissions),
    (select count(*) from public.agent_meeting_reports),
    (select sum(extract(epoch from updated_at)) from public.agent_meeting_reports),
    (select count(*) from public.employees),
    (select sum(extract(epoch from updated_at)) from public.employees)
  )
$$;

revoke all on function public.api_visits_version() from public, anon, authenticated;
grant execute on function public.api_visits_version() to service_role;

-- Make PostgREST pick up the new view and function straight away.
notify pgrst, 'reload schema';
