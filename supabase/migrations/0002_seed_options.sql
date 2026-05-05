-- DSR — seed placeholder dropdown options.
-- These are starter values. Admin can edit/reorder/disable them via /admin/options
-- without redeploying. The four hotel category values (Budget / 3* / 4* / 5*) are
-- intentionally NOT in this table because they are baked into the dsr_submissions
-- check constraint and rendering.

insert into public.placeholder_options (field_key, label, sort_order) values
  -- Flight domestic portals
  ('flight_domestic_portals',     'TBO',           10),
  ('flight_domestic_portals',     'Cleartrip B2B', 20),
  ('flight_domestic_portals',     'Akbar',         30),
  ('flight_domestic_portals',     'Via',           40),
  ('flight_domestic_portals',     'Riya',          50),
  ('flight_domestic_portals',     'MMT B2B',       60),
  ('flight_domestic_portals',     'Other',         999),

  -- Flight international portals
  ('flight_international_portals','TBO',           10),
  ('flight_international_portals','Cleartrip B2B', 20),
  ('flight_international_portals','Akbar',         30),
  ('flight_international_portals','Riya',          40),
  ('flight_international_portals','Galileo',       50),
  ('flight_international_portals','Amadeus',       60),
  ('flight_international_portals','Other',         999),

  -- Flight issue / complaint
  ('flight_issue_complaint',      'Tech',     10),
  ('flight_issue_complaint',      'Pricing',  20),
  ('flight_issue_complaint',      'Content',  30),
  ('flight_issue_complaint',      'None',     40),

  -- Hotel primary platform
  ('hotel_primary_platform',      'MMT B2B',      10),
  ('hotel_primary_platform',      'TBO Hotels',   20),
  ('hotel_primary_platform',      'Yatra B2B',    30),
  ('hotel_primary_platform',      'Agoda',        40),
  ('hotel_primary_platform',      'Expedia TAAP', 50),
  ('hotel_primary_platform',      'Other',        999),

  -- DMC destinations
  ('dmc_destination_discussed',   'Dubai',     10),
  ('dmc_destination_discussed',   'Thailand',  20),
  ('dmc_destination_discussed',   'Bali',      30),
  ('dmc_destination_discussed',   'Vietnam',   40),
  ('dmc_destination_discussed',   'Maldives',  50),

  -- DMC objections
  ('dmc_objection',               'Price',        10),
  ('dmc_objection',               'Itinerary',    20),
  ('dmc_objection',               'Visa',         30),
  ('dmc_objection',               'Product gap',  40),

  -- Visit commitment ("What did you promise the agent?")
  ('visit_commitment',            'Send quote',          10),
  ('visit_commitment',            'Schedule callback',   20),
  ('visit_commitment',            'Resolve escalation',  30),
  ('visit_commitment',            'Send rate sheet',     40),
  ('visit_commitment',            'Onboarding kickoff',  50),
  ('visit_commitment',            'Other',               999),

  -- Visit escalation routing
  ('visit_escalation',            'Tech',       10),
  ('visit_escalation',            'Finance',    20),
  ('visit_escalation',            'DMC ops',    30),
  ('visit_escalation',            'Flight ops', 40)
on conflict (field_key, label) do nothing;

-- TODO(jinay): seed the initial admin row separately once you decide on the phone
-- number, e.g.:
--
--   insert into public.employees (full_name, phone, employee_code, role)
--   values ('Jinay Sheth', '+91XXXXXXXXXX', 'ADMIN001', 'admin');
--
-- Done outside this seed file because the phone is real PII and shouldn't live in git.
