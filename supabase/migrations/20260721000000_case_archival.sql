-- Case archival: hide finished cases from day-to-day views without losing data.
-- Archived cases are excluded from /cases, /search and My Work by default and
-- can be restored at any time. Hard deletion (admin-only) requires a case to be
-- archived first and relies on existing ON DELETE CASCADE FKs from credit_cases.

ALTER TABLE "public"."credit_cases"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "archived_by" "uuid";

ALTER TABLE "public"."credit_cases"
  DROP CONSTRAINT IF EXISTS "credit_cases_archived_by_fkey";
ALTER TABLE "public"."credit_cases"
  ADD CONSTRAINT "credit_cases_archived_by_fkey"
  FOREIGN KEY ("archived_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

-- Partial index: the common filter is "not archived"; archived rows are rare.
CREATE INDEX IF NOT EXISTS "idx_credit_cases_archived_at"
  ON "public"."credit_cases" ("archived_at")
  WHERE "archived_at" IS NOT NULL;
