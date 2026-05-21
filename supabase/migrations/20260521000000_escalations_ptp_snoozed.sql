-- Migration: Add ptp_date + last_hq_update_at to escalations,
--            expand status constraint to include 'snoozed',
--            and create refresh_ptp_statuses() helper.

-- 1. Add missing columns that the collections page already queries/writes
ALTER TABLE "public"."escalations"
  ADD COLUMN IF NOT EXISTS "ptp_date" date,
  ADD COLUMN IF NOT EXISTS "last_hq_update_at" timestamp with time zone;

-- 2. Expand the status check to include 'snoozed'
ALTER TABLE "public"."escalations"
  DROP CONSTRAINT IF EXISTS "escalations_status_check";

ALTER TABLE "public"."escalations"
  ADD CONSTRAINT "escalations_status_check" CHECK (
    ("status" = ANY (ARRAY[
      'open'::"text",
      'resolved'::"text",
      'escalated_to_next'::"text",
      'snoozed'::"text"
    ]))
  );

-- 3. Create refresh_ptp_statuses() — called on every collections page load.
--    Re-opens any snoozed escalation whose PTP date has passed.
CREATE OR REPLACE FUNCTION "public"."refresh_ptp_statuses"()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "public"."escalations"
  SET
    "status" = 'open',
    "ptp_date" = NULL,
    "updated_at" = NOW()
  WHERE
    "status" = 'snoozed'
    AND "ptp_date" IS NOT NULL
    AND "ptp_date" < CURRENT_DATE;
END;
$$;

ALTER FUNCTION "public"."refresh_ptp_statuses"() OWNER TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."refresh_ptp_statuses"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."refresh_ptp_statuses"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."refresh_ptp_statuses"() TO "service_role";
