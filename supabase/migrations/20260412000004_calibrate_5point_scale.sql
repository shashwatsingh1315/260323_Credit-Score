-- ========================================================
-- MIGRATION: CALIBRATE SCORING FOR 5-POINT SCALE (POLICY v1.1)
-- ========================================================

BEGIN;

-- 1. Create New Policy Version (v1.1)
-- This clones the structure but allows us to change denominators (max_totals) 
-- without affecting historical cases linked to v1.0.
DO $$
DECLARE
    v1_id uuid := '00000000-0000-0000-0000-000000000001';
    v1_1_id uuid := '00000000-0000-0000-0000-000000000011';
BEGIN
    -- Deactivate v1.0 as the primary active policy
    UPDATE public.policy_versions SET is_active = false WHERE id = v1_id;

    -- Create v1.1
    INSERT INTO public.policy_versions (id, version_label, is_draft, is_active, description)
    VALUES (v1_1_id, 'v1.1 (5-Point Scale Calibration)', false, true, 'Recalibrated math for 1-5 grading system. 5/5 = 100%.')
    ON CONFLICT (id) DO UPDATE SET is_active = true;

    -- 2. Clone Personas
    INSERT INTO public.personas (id, policy_version_id, name, description, minimum_score, is_active)
    SELECT gen_random_uuid(), v1_1_id, name, description, minimum_score, is_active
    FROM public.personas WHERE policy_version_id = v1_id
    ON CONFLICT DO NOTHING;

    -- 3. Clone Grade Scale (1-5)
    INSERT INTO public.grade_scale (id, policy_version_id, grade_value, grade_label, description)
    SELECT gen_random_uuid(), v1_1_id, grade_value, grade_label, description
    FROM public.grade_scale WHERE policy_version_id = v1_id
    ON CONFLICT DO NOTHING;

    -- 4. Clone Score Bands
    INSERT INTO public.score_bands (id, policy_version_id, band_name, min_score, max_score, approved_credit_days, is_ambiguity_band)
    SELECT gen_random_uuid(), v1_1_id, band_name, min_score, max_score, approved_credit_days, is_ambiguity_band
    FROM public.score_bands WHERE policy_version_id = v1_id
    ON CONFLICT DO NOTHING;

    -- 5. Clone Parameters (Crucial mapping)
    -- We need to map old IDs to new IDs if we want to preserve weight matrices, 
    -- but usually parameters are unique per policy.
    INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active, is_critical, conditional_rules, auto_band_config)
    SELECT gen_random_uuid(), v1_1_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active, is_critical, conditional_rules, auto_band_config
    FROM public.parameter_definitions WHERE policy_version_id = v1_id
    ON CONFLICT DO NOTHING;

    -- 6. Set Stage Max Totals to 50
    -- Current v1.0 used 100 (assuming 10-point scale).
    -- v1.1 uses 50 (assuming 5-point scale) so that (weighted_sum / 50) * 100 correctly hits 100%.
    INSERT INTO public.stage_max_totals (id, policy_version_id, stage, max_total)
    VALUES 
      (gen_random_uuid(), v1_1_id, 1, 50),
      (gen_random_uuid(), v1_1_id, 2, 50),
      (gen_random_uuid(), v1_1_id, 3, 50)
    ON CONFLICT DO NOTHING;

END $$;

COMMIT;
