-- Migration: Preapproved credit-days range feature.
--   1. Add is_stable flag to parameter_definitions (party-level vs per-case).
--   2. Create party_preapproved_bands cache table.
--   3. Seed system_settings thresholds.
--   4. Provide refresh_party_preapproved_bands() RPC (lazy stale-row purge).

-- 1. Flag stable parameters on parameter_definitions.
--    Policy-versioned automatically because the row is FK-cascaded from policy_versions.
ALTER TABLE "public"."parameter_definitions"
  ADD COLUMN IF NOT EXISTS "is_stable" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "public"."parameter_definitions"."is_stable" IS
  'When true, this parameter is sourced from party-level history (party_history, party_exposure, or persisted party_parameter_values) and contributes to the preapproved credit-days band. Per-case parameters (is_stable=false) only contribute to the upper bound of the band.';

-- 2. Party-level preapproved band cache. One row per (party, role, policy_version).
CREATE TABLE IF NOT EXISTS "public"."party_preapproved_bands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "party_id" uuid NOT NULL,
  "party_role" text NOT NULL,
  "policy_version_id" uuid NOT NULL,
  "policy_min_days" integer,
  "policy_max_days" integer,
  "empirical_min_days" numeric,
  "empirical_max_days" numeric,
  "stable_param_coverage_pct" numeric NOT NULL DEFAULT 0,
  "closed_case_count" integer NOT NULL DEFAULT 0,
  "sufficient_history" boolean NOT NULL DEFAULT false,
  "computed_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "party_preapproved_bands_role_check"
    CHECK ("party_role" = ANY (ARRAY['customer'::text, 'contractor'::text])),
  CONSTRAINT "party_preapproved_bands_bounds_check"
    CHECK (
      ("policy_min_days" IS NULL AND "policy_max_days" IS NULL)
      OR ("policy_min_days" <= "policy_max_days")
    )
);

ALTER TABLE "public"."party_preapproved_bands" OWNER TO "postgres";

ALTER TABLE ONLY "public"."party_preapproved_bands"
  ADD CONSTRAINT "party_preapproved_bands_party_role_policy_key"
    UNIQUE ("party_id", "party_role", "policy_version_id");

ALTER TABLE ONLY "public"."party_preapproved_bands"
  ADD CONSTRAINT "party_preapproved_bands_party_id_fkey"
    FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."party_preapproved_bands"
  ADD CONSTRAINT "party_preapproved_bands_policy_version_id_fkey"
    FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_ppb_party"  ON "public"."party_preapproved_bands" USING btree ("party_id");
CREATE INDEX IF NOT EXISTS "idx_ppb_policy" ON "public"."party_preapproved_bands" USING btree ("policy_version_id");

ALTER TABLE "public"."party_preapproved_bands" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read"  ON "public"."party_preapproved_bands"
  FOR SELECT USING (("auth"."role"() = 'authenticated'::text));

CREATE POLICY "auth_write" ON "public"."party_preapproved_bands"
  USING (("auth"."role"() = 'authenticated'::text));

GRANT ALL ON TABLE "public"."party_preapproved_bands" TO "anon";
GRANT ALL ON TABLE "public"."party_preapproved_bands" TO "authenticated";
GRANT ALL ON TABLE "public"."party_preapproved_bands" TO "service_role";

-- 3. Thresholds (system_settings.value is numeric; keys follow existing UPPER_SNAKE convention).
INSERT INTO "public"."system_settings" ("key", "value", "description") VALUES
  ('MIN_CLOSED_CASES_FOR_PREAPPROVAL', 2,
    'Minimum number of closed cases a party must have before its preapproved band is shown.'),
  ('MIN_STABLE_COVERAGE_PCT_FOR_PREAPPROVAL', 60,
    'Minimum percentage of stable-parameter weight that must be resolvable from party history for the preapproved band to be shown.')
ON CONFLICT ("key") DO NOTHING;

-- 4. RPC: lazy-purge stale rows. If p_party_id is NULL, purge across all parties.
--    Always purges rows whose policy_version_id is not the active policy. Lets server
--    actions repopulate fresh rows on demand without doing the heavy compute in SQL.
CREATE OR REPLACE FUNCTION "public"."refresh_party_preapproved_bands"(p_party_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_policy uuid;
  v_deleted integer;
BEGIN
  SELECT "id" INTO v_active_policy
    FROM "public"."policy_versions"
    WHERE "is_active" = true
    LIMIT 1;

  IF v_active_policy IS NULL THEN
    RETURN 0;
  END IF;

  IF p_party_id IS NULL THEN
    DELETE FROM "public"."party_preapproved_bands"
      WHERE "policy_version_id" <> v_active_policy;
  ELSE
    DELETE FROM "public"."party_preapproved_bands"
      WHERE "party_id" = p_party_id
        AND "policy_version_id" <> v_active_policy;
  END IF;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

ALTER FUNCTION "public"."refresh_party_preapproved_bands"(uuid) OWNER TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."refresh_party_preapproved_bands"(uuid) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."refresh_party_preapproved_bands"(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."refresh_party_preapproved_bands"(uuid) TO "service_role";
