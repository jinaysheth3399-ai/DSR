-- 0006_sort_indexes.sql: indexes for the visits API sort orders.
--
-- The visits API sorts by created_at or updated_at with id as a tiebreaker,
-- and neither column was indexed, so every API request scanned and sorted the
-- whole of dsr_submissions. Over the first six months that was 853,000 full
-- table scans and ~9.9 billion rows read, about 80% of all database work, and
-- enough to saturate the Micro compute instance and take logins down with it.
-- With these in place those reads become index-only scans.
--
-- Applied by hand on 2026-11-05. `if not exists` keeps this safe to re-run.

create index if not exists dsr_submissions_created_at_id_idx
  on public.dsr_submissions (created_at, id);

create index if not exists dsr_submissions_updated_at_id_idx
  on public.dsr_submissions (updated_at, id);

analyze public.dsr_submissions;
