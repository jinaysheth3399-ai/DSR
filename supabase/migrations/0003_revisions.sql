-- 0003_revisions.sql — schema/data revisions per Jinay's feedback round 1.

-- ---------------------------------------------------------------------------
-- 1) Hotel monthly room nights — was numeric(10,2) "in lakhs", now plain
--    integer count of monthly room nights on other platforms.
-- ---------------------------------------------------------------------------
alter table public.dsr_submissions
  alter column hotel_monthly_room_nights_lakhs type numeric(10,0)
  using round(hotel_monthly_room_nights_lakhs)::numeric(10,0);

alter table public.dsr_submissions
  rename column hotel_monthly_room_nights_lakhs to hotel_monthly_room_nights_other;

-- ---------------------------------------------------------------------------
-- 2) Hotel category preference — drop "Budget" from the allowed set.
--    Existing rows that reference Budget have it stripped; if that empties
--    the array, fall back to '3*' so the nonempty constraint still holds.
-- ---------------------------------------------------------------------------
update public.dsr_submissions
   set hotel_category_preference = array_remove(hotel_category_preference, 'Budget')
 where 'Budget' = any(hotel_category_preference);

update public.dsr_submissions
   set hotel_category_preference = array['3*']
 where cardinality(hotel_category_preference) = 0;

do $$
declare
  cn text;
begin
  select conname into cn
    from pg_constraint
   where conrelid = 'public.dsr_submissions'::regclass
     and pg_get_constraintdef(oid) ilike '%Budget%hotel_category_preference%'
        or pg_get_constraintdef(oid) ilike '%hotel_category_preference%Budget%';
  if cn is not null then
    execute 'alter table public.dsr_submissions drop constraint ' || quote_ident(cn);
  end if;
end $$;

alter table public.dsr_submissions
  add constraint hotel_category_preference_chk
  check (hotel_category_preference <@ array['3*','4*','5*']);

-- ---------------------------------------------------------------------------
-- 3) Drop visit_escalation column entirely (the question is removed).
-- ---------------------------------------------------------------------------
alter table public.dsr_submissions
  drop column if exists visit_escalation;

delete from public.placeholder_options where field_key = 'visit_escalation';

-- ---------------------------------------------------------------------------
-- 4) Replace flight portal lists with the consolidated 10-portal set
--    (same options apply to both domestic and international questions).
-- ---------------------------------------------------------------------------
delete from public.placeholder_options
 where field_key in ('flight_domestic_portals', 'flight_international_portals');

insert into public.placeholder_options (field_key, label, sort_order) values
  ('flight_domestic_portals',      'TBO',           10),
  ('flight_domestic_portals',      'Cleartrip B2B', 20),
  ('flight_domestic_portals',      'Akbar',         30),
  ('flight_domestic_portals',      'Via.com',       40),
  ('flight_domestic_portals',      'Air IQ',        50),
  ('flight_domestic_portals',      'Fly24',         60),
  ('flight_domestic_portals',      'MMT B2B',       70),
  ('flight_domestic_portals',      'Riya',          80),
  ('flight_domestic_portals',      'Trip jack',     90),
  ('flight_domestic_portals',      'Blue Star',    100),
  ('flight_international_portals', 'TBO',           10),
  ('flight_international_portals', 'Cleartrip B2B', 20),
  ('flight_international_portals', 'Akbar',         30),
  ('flight_international_portals', 'Via.com',       40),
  ('flight_international_portals', 'Air IQ',        50),
  ('flight_international_portals', 'Fly24',         60),
  ('flight_international_portals', 'MMT B2B',       70),
  ('flight_international_portals', 'Riya',          80),
  ('flight_international_portals', 'Trip jack',     90),
  ('flight_international_portals', 'Blue Star',    100);
