


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'rm',
    'kam',
    'accounts',
    'bdo',
    'ordinary_approver',
    'board_member',
    'founder_admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), new.email);
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_actual_bill_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.credit_cases
  SET actual_bill_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.repayments
    WHERE case_id = COALESCE(NEW.case_id, OLD.case_id)
  )
  WHERE id = COALESCE(NEW.case_id, OLD.case_id);
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_actual_bill_amount"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_enumerations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "value" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_enumerations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_round_id" "uuid" NOT NULL,
    "approver_id" "uuid" NOT NULL,
    "decision" "text" NOT NULL,
    "comment" "text",
    "decided_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "approval_decisions_decision_check" CHECK (("decision" = ANY (ARRAY['approve'::"text", 'reject'::"text", 'return_for_revision'::"text"])))
);


ALTER TABLE "public"."approval_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_cycle_id" "uuid" NOT NULL,
    "stage" integer NOT NULL,
    "round_number" integer DEFAULT 1 NOT NULL,
    "round_type" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "appeal_reason_code" "text",
    "appeal_requested_terms" "text",
    "appeal_supporting_note" "text",
    "ambiguity_unresolved_summary" "text",
    "ambiguity_missing_items" "jsonb",
    "ambiguity_kam_recommendation" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "approval_rounds_round_type_check" CHECK (("round_type" = ANY (ARRAY['ordinary'::"text", 'appeal'::"text", 'ambiguity_board'::"text"]))),
    CONSTRAINT "approval_rounds_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'approved'::"text", 'rejected'::"text", 'returned_for_revision'::"text"])))
);


ALTER TABLE "public"."approval_rounds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "review_cycle_id" "uuid",
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "description" "text" NOT NULL,
    "field_diffs" "jsonb",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_round_id" "uuid" NOT NULL,
    "roster_snapshot" "uuid"[] NOT NULL,
    "vote_window_start" timestamp with time zone DEFAULT "now"(),
    "vote_window_end" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "board_decision" "text",
    "override_credit_days" integer,
    "override_reason_code" "text",
    "override_explanation" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "board_rounds_board_decision_check" CHECK (("board_decision" = ANY (ARRAY['uphold'::"text", 'reject'::"text", 'override'::"text"]))),
    CONSTRAINT "board_rounds_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'unresolved'::"text"])))
);


ALTER TABLE "public"."board_rounds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_round_id" "uuid" NOT NULL,
    "voter_id" "uuid" NOT NULL,
    "decision" "text" NOT NULL,
    "comment" "text",
    "voted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "board_votes_decision_check" CHECK (("decision" = ANY (ARRAY['approve'::"text", 'reject'::"text", 'abstain'::"text"])))
);


ALTER TABLE "public"."board_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "author_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "mentioned_user_ids" "uuid"[],
    "is_edited" boolean DEFAULT false,
    "edit_history" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."case_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "review_cycle_id" "uuid",
    "document_type" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "generated_by_system" boolean DEFAULT false,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."case_documents" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."case_number_seq"
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."case_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."city_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(3) NOT NULL,
    "name" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "city_codes_code_check" CHECK ((("code")::"text" ~ '^[A-Z]{3}$'::"text"))
);


ALTER TABLE "public"."city_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."committee_rosters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT 'Default Board'::"text" NOT NULL,
    "member_ids" "uuid"[] NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."committee_rosters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_number" "text" DEFAULT ((('CASE-'::"text" || (EXTRACT(year FROM "now"()))::"text") || '-'::"text") || ("nextval"('"public"."case_number_seq"'::"regclass"))::"text") NOT NULL,
    "case_scenario" "text" NOT NULL,
    "customer_party_id" "uuid",
    "contractor_party_id" "uuid",
    "bill_amount" numeric DEFAULT 0 NOT NULL,
    "requested_exposure_amount" numeric DEFAULT 0 NOT NULL,
    "proposed_tranches" "jsonb",
    "composite_credit_days" numeric,
    "branch_id" "uuid",
    "case_attributes" "jsonb",
    "commercial_notes" "text",
    "rm_user_id" "uuid" NOT NULL,
    "kam_user_id" "uuid",
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "substatus" "text",
    "closure_reason" "text",
    "closure_note" "text",
    "history_classification" "text" DEFAULT 'first_time'::"text",
    "history_override_reason" "text",
    "final_accepted_tranches" "jsonb",
    "final_composite_credit_days" numeric,
    "final_review_cycle_id" "uuid",
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1,
    "billing_date" timestamp with time zone,
    "decided_bill_amount" bigint,
    "promised_bill_amount" bigint,
    "actual_bill_amount" bigint DEFAULT 0 NOT NULL,
    "escalation_level" integer DEFAULT 0 NOT NULL,
    "original_tranches" "jsonb",
    "bill_file_url" "text",
    CONSTRAINT "credit_cases_case_scenario_check" CHECK (("case_scenario" = ANY (ARRAY['customer_name_customer_pays'::"text", 'customer_name_contractor_pays'::"text", 'contractor_name_contractor_pays'::"text"]))),
    CONSTRAINT "credit_cases_history_classification_check" CHECK (("history_classification" = ANY (ARRAY['first_time'::"text", 'repeat'::"text"]))),
    CONSTRAINT "credit_cases_status_check" CHECK (("status" = ANY (ARRAY['Draft'::"text", 'In Review'::"text", 'Awaiting Input'::"text", 'Awaiting Approval'::"text", 'Approved'::"text", 'Rejected'::"text", 'Appealed'::"text", 'Accepted'::"text", 'Closed'::"text", 'Expired'::"text", 'Billing Active'::"text", 'Pending Write-Off Approval'::"text", 'Cancelled'::"text", 'Withdrawn'::"text"])))
);


ALTER TABLE "public"."credit_cases" OWNER TO "postgres";


COMMENT ON COLUMN "public"."credit_cases"."escalation_level" IS 'Highest escalation level currently active on this case. 0 = none, 1 = KAM call, 2 = RM visit, 3 = legal notice.';



COMMENT ON COLUMN "public"."credit_cases"."original_tranches" IS 'Snapshot of proposed_tranches at the moment billing was first initialized. Never updated after first set. Used for restructure extension validation.';



CREATE TABLE IF NOT EXISTS "public"."credit_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "reduction_amount" bigint NOT NULL,
    "reason" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "logged_by" "uuid",
    "approved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_notes_reduction_amount_check" CHECK (("reduction_amount" > 0)),
    CONSTRAINT "credit_notes_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."credit_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dominance_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "customer_weight" numeric DEFAULT 0.5,
    "contractor_weight" numeric DEFAULT 0.5,
    "combination_method" "text" DEFAULT 'weighted'::"text",
    "exponent" numeric DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dominance_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escalation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escalation_id" "uuid" NOT NULL,
    "logged_by" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    "next_followup_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "escalation_logs_action_type_check" CHECK (("action_type" = ANY (ARRAY['call'::"text", 'visit'::"text", 'note'::"text"])))
);


ALTER TABLE "public"."escalation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" character varying(100) NOT NULL,
    "value" numeric NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."escalation_thresholds" AS
 SELECT
        CASE "key"
            WHEN 'ESCALATION_L1_DAYS'::"text" THEN 1
            WHEN 'ESCALATION_L2_DAYS'::"text" THEN 2
            WHEN 'ESCALATION_L3_DAYS'::"text" THEN 3
            ELSE NULL::integer
        END AS "escalation_level",
    ("value")::integer AS "days_threshold"
   FROM "public"."system_settings"
  WHERE (("key")::"text" = ANY ((ARRAY['ESCALATION_L1_DAYS'::character varying, 'ESCALATION_L2_DAYS'::character varying, 'ESCALATION_L3_DAYS'::character varying])::"text"[]));


ALTER VIEW "public"."escalation_thresholds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escalations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "tranche_index" integer NOT NULL,
    "overdue_days" integer DEFAULT 0 NOT NULL,
    "overdue_amount" bigint DEFAULT 0 NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assigned_to" "uuid",
    "trigger_reason" "text",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "escalations_level_check" CHECK (("level" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "escalations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text", 'escalated_to_next'::"text"])))
);


ALTER TABLE "public"."escalations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grade_scale" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version_id" "uuid" NOT NULL,
    "grade_value" integer NOT NULL,
    "grade_label" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."grade_scale" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hq_collection_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "logged_by" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hq_collection_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."id_prefixes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" character varying NOT NULL,
    "prefix" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."id_prefixes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "imported_by" "uuid" NOT NULL,
    "import_type" "text" NOT NULL,
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "records_total" integer DEFAULT 0,
    "records_processed" integer DEFAULT 0,
    "records_failed" integer DEFAULT 0,
    "error_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "import_jobs_import_type_check" CHECK (("import_type" = ANY (ARRAY['party_master'::"text", 'historical_exposure'::"text", 'outstanding_exposure'::"text", 'parameter_bulk_values'::"text", 'grandfathered_cases'::"text"]))),
    CONSTRAINT "import_jobs_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."import_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_mapping_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "import_type" "text" NOT NULL,
    "column_mapping" "jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."import_mapping_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "link_url" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "subject_type" "text" NOT NULL,
    "stage" integer NOT NULL,
    "default_owning_role" "public"."app_role",
    "input_type" "text" NOT NULL,
    "is_required" boolean DEFAULT true,
    "is_critical" boolean DEFAULT false,
    "rubric_guidance" "text",
    "signal_strength" "text",
    "signal_cost" "text",
    "signal_lag" "text",
    "weight" numeric DEFAULT 1.0 NOT NULL,
    "conditional_rules" "jsonb",
    "auto_band_config" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "require_reasoning" boolean DEFAULT false NOT NULL,
    "sla_days" integer,
    "persistence_scope" "text" DEFAULT 'none'::"text" NOT NULL,
    CONSTRAINT "parameter_definitions_input_type_check" CHECK (("input_type" = ANY (ARRAY['grade_select'::"text", 'numeric'::"text", 'yes_no'::"text", 'date'::"text", 'short_text'::"text", 'long_text'::"text", 'link_list'::"text", 'dropdown'::"text"]))),
    CONSTRAINT "parameter_definitions_persistence_scope_check" CHECK (("persistence_scope" = ANY (ARRAY['none'::"text", 'party'::"text", 'site'::"text", 'rm'::"text"]))),
    CONSTRAINT "parameter_definitions_stage_check" CHECK (("stage" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "parameter_definitions_subject_type_check" CHECK (("subject_type" = ANY (ARRAY['customer'::"text", 'contractor'::"text", 'case'::"text"])))
);


ALTER TABLE "public"."parameter_definitions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."parameter_definitions"."persistence_scope" IS 'Determines whether a scored value is remembered: none = per-case only, party = persists to party profile, site = persists to site, rm = persists to RM';



CREATE TABLE IF NOT EXISTS "public"."parties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legal_name" "text" NOT NULL,
    "display_name" "text",
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "address" "text",
    "gst_number" "text",
    "pan_number" "text",
    "customer_code" "text",
    "industry_category" "text",
    "is_candidate" boolean DEFAULT false,
    "created_by" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "party_type" "text",
    "influencer_subtype" "text",
    "credit_line_amount" bigint,
    "credit_line_set_at" timestamp with time zone,
    "credit_line_set_by" "uuid"
);


ALTER TABLE "public"."parties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."parties"."credit_line_amount" IS 'Admin-set manual credit limit (null = no limit configured)';



COMMENT ON COLUMN "public"."parties"."credit_line_set_at" IS 'When the credit limit was last set';



COMMENT ON COLUMN "public"."parties"."credit_line_set_by" IS 'Admin user who last set the credit limit';



CREATE TABLE IF NOT EXISTS "public"."party_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "party_id" "uuid" NOT NULL,
    "alias_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."party_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."party_exposure" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "party_id" "uuid" NOT NULL,
    "import_job_id" "uuid",
    "outstanding_amount" numeric DEFAULT 0,
    "overdue_amount" numeric DEFAULT 0,
    "overdue_days" integer DEFAULT 0,
    "data_as_of" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."party_exposure" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."party_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "party_id" "uuid" NOT NULL,
    "import_job_id" "uuid",
    "order_count" integer DEFAULT 0,
    "total_volume" numeric DEFAULT 0,
    "payment_recency_days" integer,
    "average_delay_days" numeric DEFAULT 0,
    "max_delay_days" integer DEFAULT 0,
    "data_as_of" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."party_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."party_parameter_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "party_id" "uuid" NOT NULL,
    "parameter_id" "uuid" NOT NULL,
    "grade_value" numeric,
    "raw_input_value" "text",
    "captured_from_case" "uuid",
    "captured_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."party_parameter_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "minimum_score" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."personas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version_label" "text" NOT NULL,
    "is_draft" boolean DEFAULT true,
    "is_active" boolean DEFAULT false,
    "description" "text",
    "created_by" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."policy_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "branch_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."realized_outcomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "deal_happened" boolean,
    "payment_on_time" boolean,
    "realized_delay_days" integer,
    "realized_exposure" numeric,
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."realized_outcomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repayments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "amount" bigint NOT NULL,
    "payment_date" "date" NOT NULL,
    "reference_url" "text",
    "description" "text",
    "logged_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "repayments_amount_check" CHECK (("amount" > 0))
);


ALTER TABLE "public"."repayments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "cycle_number" integer DEFAULT 1 NOT NULL,
    "policy_snapshot_id" "uuid" NOT NULL,
    "customer_persona_id" "uuid",
    "contractor_persona_id" "uuid",
    "dominance_category_id" "uuid",
    "active_stage" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true,
    "current_customer_score" numeric,
    "current_contractor_score" numeric,
    "current_case_score" numeric,
    "approved_credit_days" integer,
    "score_band_name" "text",
    "is_ambiguous" boolean DEFAULT false,
    "decision" "text",
    "decision_rationale" "text",
    "rm_facing_summary" "text",
    "validity_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "finalized_at" timestamp with time zone,
    CONSTRAINT "review_cycles_active_stage_check" CHECK (("active_stage" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "review_cycles_decision_check" CHECK (("decision" = ANY (ARRAY['approved'::"text", 'rejected'::"text", 'appealed'::"text", 'ambiguity_review'::"text", 'expired'::"text", 'withdrawn'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."review_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routing_thresholds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version_id" "uuid" NOT NULL,
    "context_rule" "jsonb",
    "target_stage" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "routing_thresholds_target_stage_check" CHECK (("target_stage" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."routing_thresholds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."score_bands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version_id" "uuid" NOT NULL,
    "band_name" "text" NOT NULL,
    "min_score" numeric NOT NULL,
    "max_score" numeric NOT NULL,
    "approved_credit_days" integer NOT NULL,
    "is_ambiguity_band" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."score_bands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stage_max_totals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version_id" "uuid" NOT NULL,
    "stage" integer NOT NULL,
    "max_total" numeric NOT NULL,
    CONSTRAINT "stage_max_totals_stage_check" CHECK (("stage" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."stage_max_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stage_readiness" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_cycle_id" "uuid" NOT NULL,
    "stage" integer NOT NULL,
    "is_ready" boolean DEFAULT false,
    "is_force_readied" boolean DEFAULT false,
    "force_ready_reason" "text",
    "missing_items" "jsonb",
    "readied_by" "uuid",
    "readied_at" timestamp with time zone
);


ALTER TABLE "public"."stage_readiness" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stage_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_cycle_id" "uuid" NOT NULL,
    "stage" integer NOT NULL,
    "task_type" "text" NOT NULL,
    "parameter_id" "uuid",
    "description" "text" NOT NULL,
    "is_required" boolean DEFAULT true,
    "is_waived" boolean DEFAULT false,
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "assigned_to" "uuid",
    "completed_by" "uuid",
    "grade_value" integer,
    "raw_input_value" "text",
    "reason" "text",
    "is_waiting" boolean DEFAULT false,
    "waiting_reason" "text",
    "waiting_started_at" timestamp with time zone,
    "sla_deadline" timestamp with time zone,
    "sla_paused_duration" interval DEFAULT '00:00:00'::interval,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "delay_reason" "text",
    CONSTRAINT "stage_tasks_stage_check" CHECK (("stage" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "stage_tasks_status_check" CHECK (("status" = ANY (ARRAY['Pending'::"text", 'In Progress'::"text", 'Completed'::"text", 'Waived'::"text"]))),
    CONSTRAINT "stage_tasks_task_type_check" CHECK (("task_type" = ANY (ARRAY['scoring'::"text", 'operational'::"text", 'ad_hoc'::"text"])))
);


ALTER TABLE "public"."stage_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."validity_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version_id" "uuid" NOT NULL,
    "context_rule" "jsonb",
    "validity_days" integer DEFAULT 90 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."validity_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weight_matrices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "persona_id" "uuid" NOT NULL,
    "parameter_id" "uuid" NOT NULL,
    "weight" numeric DEFAULT 1.0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weight_matrices" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_enumerations"
    ADD CONSTRAINT "admin_enumerations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_decisions"
    ADD CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_rounds"
    ADD CONSTRAINT "approval_rounds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_rounds"
    ADD CONSTRAINT "board_rounds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_votes"
    ADD CONSTRAINT "board_votes_board_round_id_voter_id_key" UNIQUE ("board_round_id", "voter_id");



ALTER TABLE ONLY "public"."board_votes"
    ADD CONSTRAINT "board_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_comments"
    ADD CONSTRAINT "case_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."city_codes"
    ADD CONSTRAINT "city_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."city_codes"
    ADD CONSTRAINT "city_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."committee_rosters"
    ADD CONSTRAINT "committee_rosters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_cases"
    ADD CONSTRAINT "credit_cases_case_number_key" UNIQUE ("case_number");



ALTER TABLE ONLY "public"."credit_cases"
    ADD CONSTRAINT "credit_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dominance_categories"
    ADD CONSTRAINT "dominance_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escalation_logs"
    ADD CONSTRAINT "escalation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_case_id_tranche_index_level_key" UNIQUE ("case_id", "tranche_index", "level");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grade_scale"
    ADD CONSTRAINT "grade_scale_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hq_collection_logs"
    ADD CONSTRAINT "hq_collection_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."id_prefixes"
    ADD CONSTRAINT "id_prefixes_entity_type_key" UNIQUE ("entity_type");



ALTER TABLE ONLY "public"."id_prefixes"
    ADD CONSTRAINT "id_prefixes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_mapping_templates"
    ADD CONSTRAINT "import_mapping_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_definitions"
    ADD CONSTRAINT "parameter_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parties"
    ADD CONSTRAINT "parties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."party_aliases"
    ADD CONSTRAINT "party_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."party_exposure"
    ADD CONSTRAINT "party_exposure_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."party_history"
    ADD CONSTRAINT "party_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."party_parameter_values"
    ADD CONSTRAINT "party_parameter_values_party_id_parameter_id_key" UNIQUE ("party_id", "parameter_id");



ALTER TABLE ONLY "public"."party_parameter_values"
    ADD CONSTRAINT "party_parameter_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personas"
    ADD CONSTRAINT "personas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_versions"
    ADD CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."realized_outcomes"
    ADD CONSTRAINT "realized_outcomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repayments"
    ADD CONSTRAINT "repayments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_cycles"
    ADD CONSTRAINT "review_cycles_case_id_cycle_number_key" UNIQUE ("case_id", "cycle_number");



ALTER TABLE ONLY "public"."review_cycles"
    ADD CONSTRAINT "review_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routing_thresholds"
    ADD CONSTRAINT "routing_thresholds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."score_bands"
    ADD CONSTRAINT "score_bands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stage_max_totals"
    ADD CONSTRAINT "stage_max_totals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stage_max_totals"
    ADD CONSTRAINT "stage_max_totals_policy_version_id_stage_key" UNIQUE ("policy_version_id", "stage");



ALTER TABLE ONLY "public"."stage_readiness"
    ADD CONSTRAINT "stage_readiness_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stage_tasks"
    ADD CONSTRAINT "stage_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."validity_rules"
    ADD CONSTRAINT "validity_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weight_matrices"
    ADD CONSTRAINT "weight_matrices_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_approval_decisions_approver" ON "public"."approval_decisions" USING "btree" ("approver_id");



CREATE INDEX "idx_audit_case_time" ON "public"."audit_events" USING "btree" ("case_id", "created_at");



CREATE INDEX "idx_credit_cases_kam" ON "public"."credit_cases" USING "btree" ("kam_user_id");



CREATE INDEX "idx_credit_cases_rm" ON "public"."credit_cases" USING "btree" ("rm_user_id");



CREATE UNIQUE INDEX "idx_credit_cases_site_id" ON "public"."credit_cases" USING "btree" ((("case_attributes" ->> 'site_id'::"text"))) WHERE (("case_attributes" ->> 'site_id'::"text") IS NOT NULL);



CREATE INDEX "idx_credit_notes_case_id" ON "public"."credit_notes" USING "btree" ("case_id");



CREATE INDEX "idx_credit_notes_status" ON "public"."credit_notes" USING "btree" ("status");



CREATE INDEX "idx_escalations_case_id" ON "public"."escalations" USING "btree" ("case_id");



CREATE INDEX "idx_escalations_status" ON "public"."escalations" USING "btree" ("status");



CREATE INDEX "idx_esclog_escalation_id" ON "public"."escalation_logs" USING "btree" ("escalation_id");



CREATE INDEX "idx_hq_logs_case" ON "public"."hq_collection_logs" USING "btree" ("case_id");



CREATE UNIQUE INDEX "idx_one_active_policy" ON "public"."policy_versions" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_ppv_parameter_id" ON "public"."party_parameter_values" USING "btree" ("parameter_id");



CREATE INDEX "idx_ppv_party_id" ON "public"."party_parameter_values" USING "btree" ("party_id");



CREATE INDEX "idx_repayments_case_id" ON "public"."repayments" USING "btree" ("case_id");



CREATE INDEX "idx_repayments_payment_date" ON "public"."repayments" USING "btree" ("payment_date");



CREATE OR REPLACE TRIGGER "trg_sync_actual_bill_amount" AFTER INSERT OR DELETE OR UPDATE ON "public"."repayments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_actual_bill_amount"();



CREATE OR REPLACE TRIGGER "update_actual_bill_amount_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."repayments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_actual_bill_amount"();



ALTER TABLE ONLY "public"."approval_decisions"
    ADD CONSTRAINT "approval_decisions_approval_round_id_fkey" FOREIGN KEY ("approval_round_id") REFERENCES "public"."approval_rounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_decisions"
    ADD CONSTRAINT "approval_decisions_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."approval_rounds"
    ADD CONSTRAINT "approval_rounds_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."credit_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "public"."review_cycles"("id");



ALTER TABLE ONLY "public"."board_rounds"
    ADD CONSTRAINT "board_rounds_approval_round_id_fkey" FOREIGN KEY ("approval_round_id") REFERENCES "public"."approval_rounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_votes"
    ADD CONSTRAINT "board_votes_board_round_id_fkey" FOREIGN KEY ("board_round_id") REFERENCES "public"."board_rounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_votes"
    ADD CONSTRAINT "board_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."case_comments"
    ADD CONSTRAINT "case_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."case_comments"
    ADD CONSTRAINT "case_comments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."credit_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_comments"
    ADD CONSTRAINT "case_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."stage_tasks"("id");



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."credit_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "public"."review_cycles"("id");



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."credit_cases"
    ADD CONSTRAINT "credit_cases_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."credit_cases"
    ADD CONSTRAINT "credit_cases_contractor_party_id_fkey" FOREIGN KEY ("contractor_party_id") REFERENCES "public"."parties"("id");



ALTER TABLE ONLY "public"."credit_cases"
    ADD CONSTRAINT "credit_cases_customer_party_id_fkey" FOREIGN KEY ("customer_party_id") REFERENCES "public"."parties"("id");



ALTER TABLE ONLY "public"."credit_cases"
    ADD CONSTRAINT "credit_cases_kam_user_id_fkey" FOREIGN KEY ("kam_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."credit_cases"
    ADD CONSTRAINT "credit_cases_rm_user_id_fkey" FOREIGN KEY ("rm_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."credit_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."dominance_categories"
    ADD CONSTRAINT "dominance_categories_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escalation_logs"
    ADD CONSTRAINT "escalation_logs_escalation_id_fkey" FOREIGN KEY ("escalation_id") REFERENCES "public"."escalations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escalation_logs"
    ADD CONSTRAINT "escalation_logs_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."credit_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grade_scale"
    ADD CONSTRAINT "grade_scale_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hq_collection_logs"
    ADD CONSTRAINT "hq_collection_logs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."credit_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hq_collection_logs"
    ADD CONSTRAINT "hq_collection_logs_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."import_mapping_templates"
    ADD CONSTRAINT "import_mapping_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parameter_definitions"
    ADD CONSTRAINT "parameter_definitions_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parties"
    ADD CONSTRAINT "parties_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."parties"
    ADD CONSTRAINT "parties_credit_line_set_by_fkey" FOREIGN KEY ("credit_line_set_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."party_aliases"
    ADD CONSTRAINT "party_aliases_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."party_exposure"
    ADD CONSTRAINT "party_exposure_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id");



ALTER TABLE ONLY "public"."party_exposure"
    ADD CONSTRAINT "party_exposure_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."party_history"
    ADD CONSTRAINT "party_history_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id");



ALTER TABLE ONLY "public"."party_history"
    ADD CONSTRAINT "party_history_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."party_parameter_values"
    ADD CONSTRAINT "party_parameter_values_captured_from_case_fkey" FOREIGN KEY ("captured_from_case") REFERENCES "public"."credit_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."party_parameter_values"
    ADD CONSTRAINT "party_parameter_values_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "public"."parameter_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."party_parameter_values"
    ADD CONSTRAINT "party_parameter_values_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personas"
    ADD CONSTRAINT "personas_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."policy_versions"
    ADD CONSTRAINT "policy_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."realized_outcomes"
    ADD CONSTRAINT "realized_outcomes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."credit_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."realized_outcomes"
    ADD CONSTRAINT "realized_outcomes_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."repayments"
    ADD CONSTRAINT "repayments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."credit_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."repayments"
    ADD CONSTRAINT "repayments_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."review_cycles"
    ADD CONSTRAINT "review_cycles_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."credit_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_cycles"
    ADD CONSTRAINT "review_cycles_contractor_persona_id_fkey" FOREIGN KEY ("contractor_persona_id") REFERENCES "public"."personas"("id");



ALTER TABLE ONLY "public"."review_cycles"
    ADD CONSTRAINT "review_cycles_customer_persona_id_fkey" FOREIGN KEY ("customer_persona_id") REFERENCES "public"."personas"("id");



ALTER TABLE ONLY "public"."review_cycles"
    ADD CONSTRAINT "review_cycles_dominance_category_id_fkey" FOREIGN KEY ("dominance_category_id") REFERENCES "public"."dominance_categories"("id");



ALTER TABLE ONLY "public"."review_cycles"
    ADD CONSTRAINT "review_cycles_policy_snapshot_id_fkey" FOREIGN KEY ("policy_snapshot_id") REFERENCES "public"."policy_versions"("id");



ALTER TABLE ONLY "public"."routing_thresholds"
    ADD CONSTRAINT "routing_thresholds_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."score_bands"
    ADD CONSTRAINT "score_bands_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_max_totals"
    ADD CONSTRAINT "stage_max_totals_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_readiness"
    ADD CONSTRAINT "stage_readiness_readied_by_fkey" FOREIGN KEY ("readied_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."stage_readiness"
    ADD CONSTRAINT "stage_readiness_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_tasks"
    ADD CONSTRAINT "stage_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."stage_tasks"
    ADD CONSTRAINT "stage_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."stage_tasks"
    ADD CONSTRAINT "stage_tasks_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "public"."parameter_definitions"("id");



ALTER TABLE ONLY "public"."stage_tasks"
    ADD CONSTRAINT "stage_tasks_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."validity_rules"
    ADD CONSTRAINT "validity_rules_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weight_matrices"
    ADD CONSTRAINT "weight_matrices_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "public"."parameter_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weight_matrices"
    ADD CONSTRAINT "weight_matrices_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage city codes" ON "public"."city_codes" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'founder_admin'::"public"."app_role")))));



CREATE POLICY "Admins can manage id prefixes" ON "public"."id_prefixes" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'founder_admin'::"public"."app_role")))));



CREATE POLICY "Everyone can view city codes" ON "public"."city_codes" FOR SELECT USING (true);



CREATE POLICY "Everyone can view id prefixes" ON "public"."id_prefixes" FOR SELECT USING (true);



CREATE POLICY "RM and KAM read cases" ON "public"."credit_cases" FOR SELECT USING ((("auth"."uid"() = "rm_user_id") OR ("auth"."uid"() = "kam_user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'founder_admin'::"public"."app_role"))))));



ALTER TABLE "public"."admin_enumerations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approval_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approval_rounds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_read" ON "public"."admin_enumerations" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."approval_decisions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."approval_rounds" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."audit_events" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."board_rounds" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."board_votes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."branches" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."case_comments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."case_documents" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."committee_rosters" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."credit_cases" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."dominance_categories" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."grade_scale" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."import_jobs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."import_mapping_templates" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."parameter_definitions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."parties" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."party_aliases" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."party_exposure" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."party_history" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."personas" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."policy_versions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."realized_outcomes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."review_cycles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."routing_thresholds" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."score_bands" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."stage_max_totals" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."stage_readiness" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."stage_tasks" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."user_roles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."validity_rules" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_read" ON "public"."weight_matrices" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."admin_enumerations" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."approval_decisions" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."approval_rounds" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."board_rounds" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."board_votes" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."branches" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."case_comments" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."case_documents" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."committee_rosters" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."credit_cases" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."dominance_categories" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."grade_scale" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."import_jobs" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."import_mapping_templates" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."parameter_definitions" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."parties" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."party_aliases" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."party_exposure" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."party_history" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."personas" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."policy_versions" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."profiles" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."realized_outcomes" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."review_cycles" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."routing_thresholds" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."score_bands" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."stage_max_totals" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."stage_readiness" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."stage_tasks" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."user_roles" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."validity_rules" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write" ON "public"."weight_matrices" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated_all" ON "public"."party_parameter_values" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."board_rounds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."city_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."committee_rosters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_notes_insert" ON "public"."credit_notes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['kam'::"public"."app_role", 'rm'::"public"."app_role", 'founder_admin'::"public"."app_role"]))))));



CREATE POLICY "credit_notes_select" ON "public"."credit_notes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "credit_notes_update" ON "public"."credit_notes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'founder_admin'::"public"."app_role")))));



ALTER TABLE "public"."dominance_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escalation_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escalation_logs_select" ON "public"."escalation_logs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "escalation_logs_write" ON "public"."escalation_logs" USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."escalations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escalations_select" ON "public"."escalations" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "escalations_write" ON "public"."escalations" USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."grade_scale" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hq_collection_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hq_logs_insert" ON "public"."hq_collection_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "hq_logs_select" ON "public"."hq_collection_logs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."id_prefixes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_mapping_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_audit" ON "public"."audit_events" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "insert_notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."parameter_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."party_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."party_exposure" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."party_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."party_parameter_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."policy_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ppv_select" ON "public"."party_parameter_values" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "ppv_write" ON "public"."party_parameter_values" USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read_audit" ON "public"."audit_events" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."realized_outcomes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repayments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "repayments_delete" ON "public"."repayments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['kam'::"public"."app_role", 'founder_admin'::"public"."app_role"]))))));



CREATE POLICY "repayments_insert" ON "public"."repayments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['kam'::"public"."app_role", 'founder_admin'::"public"."app_role"]))))));



CREATE POLICY "repayments_select" ON "public"."repayments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "repayments_update" ON "public"."repayments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['kam'::"public"."app_role", 'founder_admin'::"public"."app_role"]))))));



ALTER TABLE "public"."review_cycles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routing_thresholds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."score_bands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings_select" ON "public"."system_settings" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "settings_update" ON "public"."system_settings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'founder_admin'::"public"."app_role")))));



ALTER TABLE "public"."stage_max_totals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stage_readiness" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stage_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."validity_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weight_matrices" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_actual_bill_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_actual_bill_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_actual_bill_amount"() TO "service_role";


















GRANT ALL ON TABLE "public"."admin_enumerations" TO "anon";
GRANT ALL ON TABLE "public"."admin_enumerations" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_enumerations" TO "service_role";



GRANT ALL ON TABLE "public"."approval_decisions" TO "anon";
GRANT ALL ON TABLE "public"."approval_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."approval_rounds" TO "anon";
GRANT ALL ON TABLE "public"."approval_rounds" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_rounds" TO "service_role";



GRANT ALL ON TABLE "public"."audit_events" TO "anon";
GRANT ALL ON TABLE "public"."audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."board_rounds" TO "anon";
GRANT ALL ON TABLE "public"."board_rounds" TO "authenticated";
GRANT ALL ON TABLE "public"."board_rounds" TO "service_role";



GRANT ALL ON TABLE "public"."board_votes" TO "anon";
GRANT ALL ON TABLE "public"."board_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."board_votes" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."case_comments" TO "anon";
GRANT ALL ON TABLE "public"."case_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."case_comments" TO "service_role";



GRANT ALL ON TABLE "public"."case_documents" TO "anon";
GRANT ALL ON TABLE "public"."case_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."case_documents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."case_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."case_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."case_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."city_codes" TO "anon";
GRANT ALL ON TABLE "public"."city_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."city_codes" TO "service_role";



GRANT ALL ON TABLE "public"."committee_rosters" TO "anon";
GRANT ALL ON TABLE "public"."committee_rosters" TO "authenticated";
GRANT ALL ON TABLE "public"."committee_rosters" TO "service_role";



GRANT ALL ON TABLE "public"."credit_cases" TO "anon";
GRANT ALL ON TABLE "public"."credit_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_cases" TO "service_role";



GRANT ALL ON TABLE "public"."credit_notes" TO "anon";
GRANT ALL ON TABLE "public"."credit_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_notes" TO "service_role";



GRANT ALL ON TABLE "public"."dominance_categories" TO "anon";
GRANT ALL ON TABLE "public"."dominance_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."dominance_categories" TO "service_role";



GRANT ALL ON TABLE "public"."escalation_logs" TO "anon";
GRANT ALL ON TABLE "public"."escalation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."escalation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."escalation_thresholds" TO "anon";
GRANT ALL ON TABLE "public"."escalation_thresholds" TO "authenticated";
GRANT ALL ON TABLE "public"."escalation_thresholds" TO "service_role";



GRANT ALL ON TABLE "public"."escalations" TO "anon";
GRANT ALL ON TABLE "public"."escalations" TO "authenticated";
GRANT ALL ON TABLE "public"."escalations" TO "service_role";



GRANT ALL ON TABLE "public"."grade_scale" TO "anon";
GRANT ALL ON TABLE "public"."grade_scale" TO "authenticated";
GRANT ALL ON TABLE "public"."grade_scale" TO "service_role";



GRANT ALL ON TABLE "public"."hq_collection_logs" TO "anon";
GRANT ALL ON TABLE "public"."hq_collection_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."hq_collection_logs" TO "service_role";



GRANT ALL ON TABLE "public"."id_prefixes" TO "anon";
GRANT ALL ON TABLE "public"."id_prefixes" TO "authenticated";
GRANT ALL ON TABLE "public"."id_prefixes" TO "service_role";



GRANT ALL ON TABLE "public"."import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."import_mapping_templates" TO "anon";
GRANT ALL ON TABLE "public"."import_mapping_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."import_mapping_templates" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_definitions" TO "anon";
GRANT ALL ON TABLE "public"."parameter_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."parties" TO "anon";
GRANT ALL ON TABLE "public"."parties" TO "authenticated";
GRANT ALL ON TABLE "public"."parties" TO "service_role";



GRANT ALL ON TABLE "public"."party_aliases" TO "anon";
GRANT ALL ON TABLE "public"."party_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."party_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."party_exposure" TO "anon";
GRANT ALL ON TABLE "public"."party_exposure" TO "authenticated";
GRANT ALL ON TABLE "public"."party_exposure" TO "service_role";



GRANT ALL ON TABLE "public"."party_history" TO "anon";
GRANT ALL ON TABLE "public"."party_history" TO "authenticated";
GRANT ALL ON TABLE "public"."party_history" TO "service_role";



GRANT ALL ON TABLE "public"."party_parameter_values" TO "anon";
GRANT ALL ON TABLE "public"."party_parameter_values" TO "authenticated";
GRANT ALL ON TABLE "public"."party_parameter_values" TO "service_role";



GRANT ALL ON TABLE "public"."personas" TO "anon";
GRANT ALL ON TABLE "public"."personas" TO "authenticated";
GRANT ALL ON TABLE "public"."personas" TO "service_role";



GRANT ALL ON TABLE "public"."policy_versions" TO "anon";
GRANT ALL ON TABLE "public"."policy_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."policy_versions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."realized_outcomes" TO "anon";
GRANT ALL ON TABLE "public"."realized_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."realized_outcomes" TO "service_role";



GRANT ALL ON TABLE "public"."repayments" TO "anon";
GRANT ALL ON TABLE "public"."repayments" TO "authenticated";
GRANT ALL ON TABLE "public"."repayments" TO "service_role";



GRANT ALL ON TABLE "public"."review_cycles" TO "anon";
GRANT ALL ON TABLE "public"."review_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."review_cycles" TO "service_role";



GRANT ALL ON TABLE "public"."routing_thresholds" TO "anon";
GRANT ALL ON TABLE "public"."routing_thresholds" TO "authenticated";
GRANT ALL ON TABLE "public"."routing_thresholds" TO "service_role";



GRANT ALL ON TABLE "public"."score_bands" TO "anon";
GRANT ALL ON TABLE "public"."score_bands" TO "authenticated";
GRANT ALL ON TABLE "public"."score_bands" TO "service_role";



GRANT ALL ON TABLE "public"."stage_max_totals" TO "anon";
GRANT ALL ON TABLE "public"."stage_max_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."stage_max_totals" TO "service_role";



GRANT ALL ON TABLE "public"."stage_readiness" TO "anon";
GRANT ALL ON TABLE "public"."stage_readiness" TO "authenticated";
GRANT ALL ON TABLE "public"."stage_readiness" TO "service_role";



GRANT ALL ON TABLE "public"."stage_tasks" TO "anon";
GRANT ALL ON TABLE "public"."stage_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."stage_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."validity_rules" TO "anon";
GRANT ALL ON TABLE "public"."validity_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."validity_rules" TO "service_role";



GRANT ALL ON TABLE "public"."weight_matrices" TO "anon";
GRANT ALL ON TABLE "public"."weight_matrices" TO "authenticated";
GRANT ALL ON TABLE "public"."weight_matrices" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































