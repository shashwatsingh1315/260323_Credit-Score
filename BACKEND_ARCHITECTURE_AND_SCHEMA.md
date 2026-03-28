# Backend Architecture and Schema

# Technical Architecture

## Recommended Stack

Recommended v1 stack:

- `Next.js` application deployed on `Vercel`
- `Supabase` for authentication and primary data services
- responsive web UI

The app should be designed to work well on desktop and remain usable on mobile browsers for field and task users.

Proactive-ready in v1 means preserving data hooks, not building proactive workflows. The system should already hold:

- reusable party history
- realized outcome data
- approval validity and expiry data
- outstanding exposure and overdue data

It should not yet implement proactive queues, renewal screens, or periodic watchlist workflows.

## Core Architectural Modules

Suggested bounded modules:

1. `case-workflow`
- credit case creation
- review-cycle lifecycle
- stage routing
- waiting, revision, expiry, closure

2. `policy-and-scoring`
- parameters
- personas
- weight matrices
- score bands
- ambiguity rules
- credit-day mapping
- policy snapshots

3. `approvals-and-boards`
- ordinary approvals
- appeal flow
- ambiguity review
- board voting

4. `party-history-and-imports`
- party master
- matching and aliases
- history imports
- derived metrics
- outstanding exposure

5. `audit-and-reporting`
- event logging
- field diffs
- sensitive-view logs
- dashboards
- CSV exports
- decision memo generation

6. `admin-and-governance`
- user management
- branches/regions
- policy draft/publish
- simulations
- committee rosters

## Data Model Overview

High-level data model concepts:

- `users`
- `user_roles`
- `branches`
- `parties`
- `party_aliases`
- `credit_cases`
- `review_cycles`
- `cycle_policy_snapshots`
- `stages`
- `tasks`
- `task_comments`
- `approval_rounds`
- `approval_decisions`
- `board_rounds`
- `board_votes`
- `policy_versions`
- `parameter_definitions`
- `persona_models`
- `weight_matrices`
- `dominance_matrices`
- `imports`
- `import_mappings`
- `case_events`
- `decision_memos`

## Security And Access

The system needs:

- role-based authorization
- sensitive-section restrictions
- audit logging
- safe password-reset flow through email-backed accounts

The app does not require:

- offline synchronization
- external public user access
- multi-tenant SaaS-style separation

## Responsive Requirement

The app must work on mobile browsers for BDO and task execution, but v1 is not a mobile-native app and does not require offline-first capability.

Responsive priorities:

- task completion screens
- comments and mentions
- case summary visibility
- basic approval actions

## Fixed Technical Assumptions

- English-only UI and generated artifacts in v1
- single-currency model
- no native file storage requirement for evidence in v1
- Google Drive links used for audit evidence
- no live ERP integration required in v1

## Implementation Guidance

- Keep policy data separate from workflow-state data.
- Keep frozen round snapshots explicit for approvals and board reviews.
- Make review-cycle snapshots first-class rather than derived only from latest state.
- Design the schema so proactive modules can later be added without rewriting case or party fundamentals.


## Database Schema Details

Below is the complete database schema including all tables, constraints, ENUMs, Row-Level Security (RLS) policies, and triggers from the initial migration.

```sql
-- =============================================================
-- CREDIT ISSUANCE SYSTEM — COMPLETE V1 DATABASE SCHEMA
-- Single migration covering all tables for the full system.
-- =============================================================

-- =====================
-- 1. IDENTITY & ACCESS
-- =====================

-- Branches / Regions (admin-managed master data)
CREATE TABLE IF NOT EXISTS public.branches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- User profiles extending Supabase Auth
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    email text NOT NULL,
    branch_id uuid REFERENCES public.branches(id),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Roles (fixed set in V1)
CREATE TYPE public.app_role AS ENUM (
    'rm', 'kam', 'accounts', 'bdo',
    'ordinary_approver', 'board_member', 'founder_admin'
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    UNIQUE(user_id, role)
);

-- =====================
-- 2. PARTY MASTER
-- =====================

CREATE TABLE IF NOT EXISTS public.parties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name text NOT NULL,
    display_name text,
    contact_name text,
    contact_email text,
    contact_phone text,
    address text,
    gst_number text,
    pan_number text,
    customer_code text,
    industry_category text,
    is_candidate boolean DEFAULT false, -- candidate = not yet verified
    created_by uuid REFERENCES public.profiles(id),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.party_aliases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    alias_name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- =====================
-- 3. POLICY ENGINE
-- =====================

CREATE TABLE IF NOT EXISTS public.policy_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_label text NOT NULL,
    is_draft boolean DEFAULT true,
    is_active boolean DEFAULT false,
    description text,
    created_by uuid REFERENCES public.profiles(id),
    published_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Only one active policy at a time
CREATE UNIQUE INDEX idx_one_active_policy ON public.policy_versions (is_active) WHERE is_active = true;

-- Personas
CREATE TABLE IF NOT EXISTS public.personas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id uuid NOT NULL REFERENCES public.policy_versions(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    minimum_score integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Dominance Categories
CREATE TABLE IF NOT EXISTS public.dominance_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id uuid NOT NULL REFERENCES public.policy_versions(id) ON DELETE CASCADE,
    name text NOT NULL,
    customer_weight numeric DEFAULT 0.5,
    contractor_weight numeric DEFAULT 0.5,
    combination_method text DEFAULT 'weighted', -- 'weighted', 'power_law', 'customer_only', 'contractor_only'
    exponent numeric DEFAULT 1.0,
    created_at timestamptz DEFAULT now()
);

-- Parameter Definitions
CREATE TABLE IF NOT EXISTS public.parameter_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id uuid NOT NULL REFERENCES public.policy_versions(id) ON DELETE CASCADE,
    name text NOT NULL,
    subject_type text NOT NULL CHECK (subject_type IN ('customer', 'contractor', 'case')),
    stage integer NOT NULL CHECK (stage IN (1, 2, 3)),
    default_owning_role public.app_role,
    input_type text NOT NULL CHECK (input_type IN ('grade_select', 'numeric', 'yes_no', 'date', 'short_text', 'long_text', 'link_list')),
    is_required boolean DEFAULT true,
    is_critical boolean DEFAULT false,
    rubric_guidance text,
    signal_strength text,
    signal_cost text,
    signal_lag text,
    weight numeric NOT NULL DEFAULT 1.0,
    conditional_rules jsonb, -- { "scenarios": [...], "personas": [...], "history": "first_time" | "repeat" }
    auto_band_config jsonb, -- for numeric/date: { "bands": [{"min": 0, "max": 30, "grade": 5}, ...] }
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Grade Scale (shared across parameters)
CREATE TABLE IF NOT EXISTS public.grade_scale (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id uuid NOT NULL REFERENCES public.policy_versions(id) ON DELETE CASCADE,
    grade_value integer NOT NULL,
    grade_label text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Weight Matrices (per persona per stage)
CREATE TABLE IF NOT EXISTS public.weight_matrices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
    parameter_id uuid NOT NULL REFERENCES public.parameter_definitions(id) ON DELETE CASCADE,
    weight numeric NOT NULL DEFAULT 1.0,
    created_at timestamptz DEFAULT now()
);

-- Stage Max Totals
CREATE TABLE IF NOT EXISTS public.stage_max_totals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id uuid NOT NULL REFERENCES public.policy_versions(id) ON DELETE CASCADE,
    stage integer NOT NULL CHECK (stage IN (1, 2, 3)),
    max_total numeric NOT NULL,
    UNIQUE(policy_version_id, stage)
);

-- Score Bands → Credit Days
CREATE TABLE IF NOT EXISTS public.score_bands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id uuid NOT NULL REFERENCES public.policy_versions(id) ON DELETE CASCADE,
    band_name text NOT NULL,
    min_score numeric NOT NULL,
    max_score numeric NOT NULL,
    approved_credit_days integer NOT NULL,
    is_ambiguity_band boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Approval Validity Windows (rule-driven)
CREATE TABLE IF NOT EXISTS public.validity_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id uuid NOT NULL REFERENCES public.policy_versions(id) ON DELETE CASCADE,
    context_rule jsonb, -- { "score_band": "A", "scenario": "..." }
    validity_days integer NOT NULL DEFAULT 90,
    created_at timestamptz DEFAULT now()
);

-- Admin Enumerations (closure reasons, waiting reasons, case attributes)
CREATE TABLE IF NOT EXISTS public.admin_enumerations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL, -- 'closure_reason', 'waiting_reason', 'product_category', 'market_segment', 'deal_size_bucket', 'project_type'
    value text NOT NULL,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Routing Thresholds
CREATE TABLE IF NOT EXISTS public.routing_thresholds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id uuid NOT NULL REFERENCES public.policy_versions(id) ON DELETE CASCADE,
    context_rule jsonb, -- { "exposure_min": 1000000, "score_below": 50 }
    target_stage integer NOT NULL CHECK (target_stage IN (1, 2, 3)),
    created_at timestamptz DEFAULT now()
);

-- Committee Rosters
CREATE TABLE IF NOT EXISTS public.committee_rosters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL DEFAULT 'Default Board',
    member_ids uuid[] NOT NULL, -- array of profile IDs
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- =====================
-- 4. CREDIT CASES
-- =====================

-- Case number sequence
CREATE SEQUENCE IF NOT EXISTS public.case_number_seq START 1001;

CREATE TABLE IF NOT EXISTS public.credit_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number text NOT NULL UNIQUE DEFAULT ('CASE-' || extract(year from now())::text || '-' || nextval('public.case_number_seq')::text),

    -- Scenario
    case_scenario text NOT NULL CHECK (case_scenario IN (
        'customer_name_customer_pays',
        'customer_name_contractor_pays',
        'contractor_name_contractor_pays'
    )),

    -- Parties
    customer_party_id uuid REFERENCES public.parties(id),
    contractor_party_id uuid REFERENCES public.parties(id),

    -- Commercial
    bill_amount numeric NOT NULL DEFAULT 0,
    requested_exposure_amount numeric NOT NULL DEFAULT 0,
    proposed_tranches jsonb, -- [{ "type": "amount"|"percentage", "value": 1000, "days_after_billing": 30 }]
    composite_credit_days numeric,

    -- Context
    branch_id uuid REFERENCES public.branches(id),
    case_attributes jsonb, -- { "product_category": "...", "market_segment": "...", "deal_size_bucket": "..." }
    commercial_notes text,

    -- Ownership
    rm_user_id uuid NOT NULL REFERENCES public.profiles(id),
    kam_user_id uuid REFERENCES public.profiles(id),

    -- Status
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN (
        'Draft', 'In Review', 'Awaiting Input', 'Awaiting Approval',
        'Approved', 'Rejected', 'Appealed', 'Accepted', 'Closed', 'Expired'
    )),
    substatus text,
    closure_reason text,
    closure_note text,

    -- History context
    history_classification text DEFAULT 'first_time' CHECK (history_classification IN ('first_time', 'repeat')),
    history_override_reason text,

    -- Final accepted structure
    final_accepted_tranches jsonb,
    final_composite_credit_days numeric,
    final_review_cycle_id uuid, -- set when accepted

    -- Timestamps
    submitted_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Optimistic concurrency
    version integer DEFAULT 1
);

-- =====================
-- 5. REVIEW CYCLES
-- =====================

CREATE TABLE IF NOT EXISTS public.review_cycles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES public.credit_cases(id) ON DELETE CASCADE,
    cycle_number integer NOT NULL DEFAULT 1,

    policy_snapshot_id uuid NOT NULL REFERENCES public.policy_versions(id),
    customer_persona_id uuid REFERENCES public.personas(id),
    contractor_persona_id uuid REFERENCES public.personas(id),
    dominance_category_id uuid REFERENCES public.dominance_categories(id),

    active_stage integer NOT NULL DEFAULT 1 CHECK (active_stage IN (1, 2, 3)),
    is_active boolean DEFAULT true,

    -- Scoring
    current_customer_score numeric,
    current_contractor_score numeric,
    current_case_score numeric,
    approved_credit_days integer,
    score_band_name text,
    is_ambiguous boolean DEFAULT false,

    -- Decision
    decision text CHECK (decision IN ('approved', 'rejected', 'appealed', 'ambiguity_review', 'expired', 'withdrawn', 'superseded')),
    decision_rationale text,
    rm_facing_summary text,

    -- Validity
    validity_expires_at timestamptz,

    created_at timestamptz DEFAULT now(),
    finalized_at timestamptz,
    UNIQUE(case_id, cycle_number)
);

-- =====================
-- 6. STAGE TASKS
-- =====================

CREATE TABLE IF NOT EXISTS public.stage_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_cycle_id uuid NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
    stage integer NOT NULL CHECK (stage IN (1, 2, 3)),

    task_type text NOT NULL CHECK (task_type IN ('scoring', 'operational', 'ad_hoc')),
    parameter_id uuid REFERENCES public.parameter_definitions(id), -- for scoring tasks
    description text NOT NULL,
    is_required boolean DEFAULT true,
    is_waived boolean DEFAULT false,

    status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Waived')),
    assigned_to uuid REFERENCES public.profiles(id),
    completed_by uuid REFERENCES public.profiles(id),

    -- Scoring data (for scoring tasks)
    grade_value integer,
    raw_input_value text,
    reason text,

    -- Waiting
    is_waiting boolean DEFAULT false,
    waiting_reason text,
    waiting_started_at timestamptz,

    -- SLA
    sla_deadline timestamptz,
    sla_paused_duration interval DEFAULT '0'::interval,

    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- Stage readiness tracking
CREATE TABLE IF NOT EXISTS public.stage_readiness (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_cycle_id uuid NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
    stage integer NOT NULL,
    is_ready boolean DEFAULT false,
    is_force_readied boolean DEFAULT false,
    force_ready_reason text,
    missing_items jsonb, -- ["Parameter X", "Task Y"]
    readied_by uuid REFERENCES public.profiles(id),
    readied_at timestamptz
);

-- =====================
-- 7. APPROVALS
-- =====================

CREATE TABLE IF NOT EXISTS public.approval_rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_cycle_id uuid NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
    stage integer NOT NULL,
    round_number integer NOT NULL DEFAULT 1,
    round_type text NOT NULL CHECK (round_type IN ('ordinary', 'appeal', 'ambiguity_board')),

    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected', 'returned_for_revision')),

    -- Appeal-specific
    appeal_reason_code text,
    appeal_requested_terms text,
    appeal_supporting_note text,

    -- Ambiguity-specific
    ambiguity_unresolved_summary text,
    ambiguity_missing_items jsonb,
    ambiguity_kam_recommendation text,

    created_at timestamptz DEFAULT now(),
    resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.approval_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_round_id uuid NOT NULL REFERENCES public.approval_rounds(id) ON DELETE CASCADE,
    approver_id uuid NOT NULL REFERENCES public.profiles(id),
    decision text NOT NULL CHECK (decision IN ('approve', 'reject', 'return_for_revision')),
    comment text,
    decided_at timestamptz DEFAULT now()
);

-- =====================
-- 8. BOARD VOTING
-- =====================

CREATE TABLE IF NOT EXISTS public.board_rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_round_id uuid NOT NULL REFERENCES public.approval_rounds(id) ON DELETE CASCADE,
    roster_snapshot uuid[] NOT NULL, -- frozen member list
    vote_window_start timestamptz DEFAULT now(),
    vote_window_end timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'unresolved')),

    -- Board decision
    board_decision text CHECK (board_decision IN ('uphold', 'reject', 'override')),
    override_credit_days integer,
    override_reason_code text,
    override_explanation text,

    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.board_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    board_round_id uuid NOT NULL REFERENCES public.board_rounds(id) ON DELETE CASCADE,
    voter_id uuid NOT NULL REFERENCES public.profiles(id),

    decision text NOT NULL CHECK (decision IN ('approve', 'reject', 'abstain')),
    comment text,

    voted_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(board_round_id, voter_id) -- one vote per member per round (updatable)
);

-- =====================
-- 9. AUDIT & EVENTS
-- =====================

CREATE TABLE IF NOT EXISTS public.audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid REFERENCES public.credit_cases(id) ON DELETE CASCADE,
    review_cycle_id uuid REFERENCES public.review_cycles(id),

    event_type text NOT NULL, -- 'submission', 'field_change', 'stage_transition', 'approval', 'return_revision', 'board_vote', 'override', 'sensitive_view', 'expiry', 'withdrawal', 'closure'
    actor_id uuid REFERENCES public.profiles(id),
    description text NOT NULL,
    field_diffs jsonb, -- { "field": "bill_amount", "old": "1000", "new": "2000" }
    metadata jsonb,

    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_case_time ON public.audit_events(case_id, created_at);

-- =====================
-- 10. NOTIFICATIONS
-- =====================

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text,
    link_url text,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- =====================
-- 11. COMMENTS
-- =====================

CREATE TABLE IF NOT EXISTS public.case_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES public.credit_cases(id) ON DELETE CASCADE,
    task_id uuid REFERENCES public.stage_tasks(id),
    author_id uuid NOT NULL REFERENCES public.profiles(id),
    body text NOT NULL,
    mentioned_user_ids uuid[],
    is_edited boolean DEFAULT false,
    edit_history jsonb, -- [{ "body": "old text", "edited_at": "..." }]
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =====================
-- 12. DOCUMENTS
-- =====================

CREATE TABLE IF NOT EXISTS public.case_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES public.credit_cases(id) ON DELETE CASCADE,
    review_cycle_id uuid REFERENCES public.review_cycles(id),
    document_type text NOT NULL, -- 'decision_memo', 'evidence', 'import'
    file_url text NOT NULL,
    generated_by_system boolean DEFAULT false,
    uploaded_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now()
);

-- =====================
-- 13. DATA IMPORTS
-- =====================

CREATE TABLE IF NOT EXISTS public.import_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    imported_by uuid NOT NULL REFERENCES public.profiles(id),
    import_type text NOT NULL CHECK (import_type IN ('party_master', 'historical_exposure', 'outstanding_exposure')),
    status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    records_total integer DEFAULT 0,
    records_processed integer DEFAULT 0,
    records_failed integer DEFAULT 0,
    error_details jsonb,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.import_mapping_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    import_type text NOT NULL,
    column_mapping jsonb NOT NULL, -- { "csv_column": "db_field", ... }
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now()
);

-- =====================
-- 14. PARTY HISTORY / EXPOSURE
-- =====================

CREATE TABLE IF NOT EXISTS public.party_exposure (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    import_job_id uuid REFERENCES public.import_jobs(id),
    outstanding_amount numeric DEFAULT 0,
    overdue_amount numeric DEFAULT 0,
    overdue_days integer DEFAULT 0,
    data_as_of timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.party_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    import_job_id uuid REFERENCES public.import_jobs(id),
    order_count integer DEFAULT 0,
    total_volume numeric DEFAULT 0,
    payment_recency_days integer,
    average_delay_days numeric DEFAULT 0,
    max_delay_days integer DEFAULT 0,
    data_as_of timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- =====================
-- 15. REALIZED OUTCOMES
-- =====================

CREATE TABLE IF NOT EXISTS public.realized_outcomes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES public.credit_cases(id) ON DELETE CASCADE,
    deal_happened boolean,
    payment_on_time boolean,
    realized_delay_days integer,
    realized_exposure numeric,
    notes text,
    recorded_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now()
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dominance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parameter_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_scale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_max_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validity_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_enumerations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_mapping_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_exposure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realized_outcomes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read most tables (role-level filtering in app)
CREATE POLICY "auth_read" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.user_roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.branches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.parties FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.party_aliases FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.policy_versions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.personas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.dominance_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.parameter_definitions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.grade_scale FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.weight_matrices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.stage_max_totals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.score_bands FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.validity_rules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.admin_enumerations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.routing_thresholds FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.committee_rosters FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.credit_cases FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.review_cycles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.stage_tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.stage_readiness FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.approval_rounds FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.approval_decisions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.board_rounds FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.board_votes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.audit_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.case_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.case_documents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.import_jobs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.import_mapping_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.party_exposure FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.party_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.realized_outcomes FOR SELECT USING (auth.role() = 'authenticated');

-- Notifications: user reads own only
CREATE POLICY "own_notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_notifications" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Write policies: authenticated can write (app-level role checks enforce granularity)
CREATE POLICY "auth_write" ON public.credit_cases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.review_cycles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.stage_tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.stage_readiness FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.approval_rounds FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.approval_decisions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.board_rounds FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.board_votes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.case_comments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.case_documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.parties FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.party_aliases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.realized_outcomes FOR ALL USING (auth.role() = 'authenticated');

-- Audit: insert only, no update/delete
CREATE POLICY "insert_audit" ON public.audit_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "read_audit" ON public.audit_events FOR SELECT USING (auth.role() = 'authenticated');

-- Admin-only writes for policy/config tables (simplified: app enforces admin check)
CREATE POLICY "auth_write" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.user_roles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.branches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.policy_versions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.personas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.dominance_categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.parameter_definitions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.grade_scale FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.weight_matrices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.stage_max_totals FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.score_bands FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.validity_rules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.admin_enumerations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.routing_thresholds FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.committee_rosters FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.import_jobs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.import_mapping_templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.party_exposure FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.party_history FOR ALL USING (auth.role() = 'authenticated');

-- =====================
-- SEED DATA
-- =====================

-- Default branches
INSERT INTO public.branches (name) VALUES ('North'), ('South'), ('East'), ('West');

-- Default closure reasons
INSERT INTO public.admin_enumerations (category, value, sort_order) VALUES
    ('closure_reason', 'Rejected', 1),
    ('closure_reason', 'Customer Declined', 2),
    ('closure_reason', 'Duplicate', 3),
    ('closure_reason', 'Superseded', 4),
    ('closure_reason', 'Expired', 5);

-- Default waiting reasons
INSERT INTO public.admin_enumerations (category, value, sort_order) VALUES
    ('waiting_reason', 'Awaiting RM documents', 1),
    ('waiting_reason', 'Awaiting financial statements', 2),
    ('waiting_reason', 'Awaiting site visit report', 3),
    ('waiting_reason', 'Awaiting bank statements', 4),
    ('waiting_reason', 'External verification pending', 5);

-- Default product categories
INSERT INTO public.admin_enumerations (category, value, sort_order) VALUES
    ('product_category', 'Manufacturing', 1),
    ('product_category', 'Technology', 2),
    ('product_category', 'Logistics', 3),
    ('product_category', 'Construction', 4);

-- Default deal size buckets
INSERT INTO public.admin_enumerations (category, value, sort_order) VALUES
    ('deal_size_bucket', 'Small (< 10L)', 1),
    ('deal_size_bucket', 'Medium (10L - 1Cr)', 2),
    ('deal_size_bucket', 'Large (1Cr - 10Cr)', 3),
    ('deal_size_bucket', 'Enterprise (> 10Cr)', 4);

```
