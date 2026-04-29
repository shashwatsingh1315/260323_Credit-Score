-- M4: Add original_tranches to credit_cases
--     Stores the tranche schedule as it was at billing initialization (snapshot).
--     Written once; never overwritten even if proposed_tranches is later restructured.

ALTER TABLE credit_cases
  ADD COLUMN IF NOT EXISTS original_tranches jsonb;

COMMENT ON COLUMN credit_cases.original_tranches IS
  'Snapshot of proposed_tranches taken at billing init. Used as the baseline for max-extension enforcement during restructure. Null for cases that pre-date this migration.';
