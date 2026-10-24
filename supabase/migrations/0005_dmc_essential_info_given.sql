-- 0005_dmc_essential_info_given.sql: adds the "Essential information given"
-- question to the DMC section of the DSR form.
--
-- Deliberately nullable with no default. Every row that already exists was
-- submitted before this question was asked, so null means "not asked" and is
-- distinct from a real "No". Backfilling false would misreport roughly 12,000
-- historical visits as the rep having withheld the information. The app always
-- writes a boolean, so null only ever appears on pre-migration rows.

alter table public.dsr_submissions
  add column dmc_essential_info_given boolean;
