-- ========================================================
-- MIGRATION: REMEDIATE PARAMETER DUPLICATES & REDUNDANCY
-- ========================================================

BEGIN;

-- 1. Fix Spelling of "Businesses"
UPDATE public.parameter_definitions 
SET name = 'Balance Sheet (Businesses)'
WHERE name = 'Balance Sheet (Buisnesses)';

-- 2. Deduplicate parameters within the same policy version
-- We keep the record with the lowest ID for each (name, policy_version_id, stage, subject_type)
DELETE FROM public.parameter_definitions a
USING public.parameter_definitions b
WHERE a.id > b.id
  AND a.name = b.name
  AND a.policy_version_id = b.policy_version_id
  AND a.stage = b.stage
  AND a.subject_type = b.subject_type;

-- 3. Deactivate Redundant Stage 2 RM Tasks
-- If a parameter is assigned to RM in both Stage 1 and Stage 2, Stage 2 is considered redundant.
UPDATE public.parameter_definitions
SET is_active = false
WHERE name IN ('Influencer Confidence', 'Credit Reason RCA', 'Occupation')
  AND stage = 2
  AND LOWER(default_owning_role) = 'rm';

-- 4. Audit: Ensure 'Influencer Confidence' uses 'customer' or 'both' correctly 
-- (Assuming 'customer' is correct for now as it maps to the case scenario logic)
-- But we can tag it with a better description if needed.
UPDATE public.parameter_definitions
SET rubric_guidance = rubric_guidance || '\n\n**Note**: This task is for evaluating the Influencer''s role in the Customer''s repayment reliability.'
WHERE name = 'Influencer Confidence' AND is_active = true;

COMMIT;
