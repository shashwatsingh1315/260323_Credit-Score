-- ========================================================
-- SEED SCRIPT FOR CREDIT ISSUANCE MATRIX V1.0
-- ========================================================

BEGIN;

-- 1. Create Active Policy Version
-- Deactivate others first to satisfy idx_one_active_policy
UPDATE public.policy_versions SET is_active = false WHERE is_active = true;

INSERT INTO public.policy_versions (id, version_label, is_draft, is_active, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'v1.0 (Default Matrix)', false, true, 'Default system matrix for scoring')
ON CONFLICT (id) DO UPDATE SET is_active = true, version_label = EXCLUDED.version_label;

-- 2. Create Personas
INSERT INTO public.personas (id, policy_version_id, name, description, minimum_score, is_active)
VALUES 
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Customer', 'Default Customer Persona', 0, true),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Contractor', 'Default Contractor Persona', 0, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 3. Create Grade Scale
INSERT INTO public.grade_scale (id, policy_version_id, grade_value, grade_label, description)
VALUES 
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 1, '1', 'Lowest grade / High Risk'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 2, '2', 'Below Average'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 3, '3', 'Average'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 4, '4', 'Good'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 5, '5', 'Excellent');

-- Parameter: Size Scale Stature (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('1d099aa5-03c2-477e-94d5-2dab4848b48c', '00000000-0000-0000-0000-000000000001', 'Size Scale Stature', 'contractor', 1, 'rm', 'grade_select', '3', '2', 'Leading', 1.0, '**Definition:**\n- Measures execution capacity and financial bandwidth by evaluating the sheer volume of operations.<br>- Claimed numbers (Turnover and Team Size) must logically match the visible reality on the ground.\n\n**Ratings:**\n- **[1]**: -Turnover: Under ₹12 Lakh\n- **[2]**: <br>-Workforce: Less than 10 workers\n- **[3]**: <br>-Key Notes: Highly unorganized, living project-to-project, very high risk of cash flow freezing.\n- **[4]**: -Turnover: Borderline Small pushing towards 12 -₹20 Lakh\n- **[5]**: <br>-Workforce: 8–10 workers', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '1d099aa5-03c2-477e-94d5-2dab4848b48c', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Size Scale Stature (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('b94536b2-8b2e-49e2-8833-09442766b032', '00000000-0000-0000-0000-000000000001', 'Size Scale Stature', 'contractor', 2, 'bdo', 'grade_select', '3', '2', 'Leading', 1.0, '**Definition:**\n- Measures execution capacity and financial bandwidth by evaluating the sheer volume of operations.<br>- Claimed numbers (Turnover and Team Size) must logically match the visible reality on the ground.\n\n**Ratings:**\n- **[1]**: -Turnover: Under ₹12 Lakh\n- **[2]**: <br>-Workforce: Less than 10 workers\n- **[3]**: <br>-Key Notes: Highly unorganized, living project-to-project, very high risk of cash flow freezing.\n- **[4]**: -Turnover: Borderline Small pushing towards 12 -₹20 Lakh\n- **[5]**: <br>-Workforce: 8–10 workers', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', 'b94536b2-8b2e-49e2-8833-09442766b032', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Religion/ Sub Group (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('0bf40c8b-71ad-4a0e-91c3-c2654405985d', '00000000-0000-0000-0000-000000000001', 'Religion/ Sub Group', 'contractor', 1, 'rm', 'grade_select', '2', '1', 'Leading', 1.0, '**Definition:**\n-Historical data/statistical probability of trade community B2B payment trends.\n\n**Ratings:**\n- **[1]**: Historically High Risk: Highest probability of default, prolonged delays, or credit disputes.\n- **[2]**: Below Average / High-Medium Risk: Noticeable trend of delayed payments or renegotiating terms post-delivery.\n- **[3]**: Market Average / Medium Risk: Standard market behavior; occasional delays.\n- **[4]**: Strong History / Low Risk: Very low historical default rates, generally reliable.\n- **[5]**: Excellent History / Lowest Default Risk: Highest repayment discipline; defaults/disputes extremely rare.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '0bf40c8b-71ad-4a0e-91c3-c2654405985d', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Price per Sq ft (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('24fabb4f-ba47-410e-b7cf-4b7a36a7aff9', '00000000-0000-0000-0000-000000000001', 'Price per Sq ft', 'contractor', 1, 'rm', 'grade_select', '3', '2', 'Leading', 1.0, '**Definition:**\nMeasures contractor''s pricing power, margin safety, and end-client quality.\n\n**Ratings:**\n- **[1]**: Cheap / Substandard: â‚¹18 or below per sq. ft. Extremely cheap rates, cutting corners, high rejection risk.\n- **[2]**: Budget / Compromised: â‚¹23 per sq. ft. Heavy cost-cutting, very tight budgets, high risk on rework.\n- **[3]**: Standard / Mid-Market: â‚¹24 to â‚¹39 per sq. ft. Standard market average, good functional work.\n- **[4]**: Premium / High-Quality: â‚¹40 to â‚¹79 per sq. ft. Above-market pricing, upper-middle-class clients.\n- **[5]**: Super Luxury / Elite: ¹80+ per sq. ft. Exceptional margins, imported materials, high-net-worth clients.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '24fabb4f-ba47-410e-b7cf-4b7a36a7aff9', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Contractor Reputation (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('8eb2e1df-b2f1-4c59-bb1c-e6bd6e0e699c', '00000000-0000-0000-0000-000000000001', 'Contractor Reputation', 'contractor', 1, 'rm', 'grade_select', '4', '4', 'Lagging', 1.0, '**Definition:**\nEvaluates behavioral risk and trade ethics regarding labor and sub-contractors.\n\n**Ratings:**\n- **[1]**: Toxic / High Risk: History of site abandonment, aggression with vendors, using local influence to avoid dues.\n- **[2]**: Friction-Prone / Warning: Known for being ''clever'' with bills, finding small faults to deduct money.\n- **[3]**: Average / Neutral: Typical contractor, no major red flags, payments follow general market lag.\n- **[4]**: Strong / Reliable: Professional/ethical. Disputes settled quickly through dialogue.\n- **[5]**: Excellent / Role Model: Flawless standing, loyal workforce, closes vendor accounts without dispute.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '8eb2e1df-b2f1-4c59-bb1c-e6bd6e0e699c', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Contractor Reputation (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('18274fdb-3e91-4061-a77c-9d208bfee3f4', '00000000-0000-0000-0000-000000000001', 'Contractor Reputation', 'contractor', 2, 'rm', 'grade_select', '4', '4', 'Lagging', 1.0, '**Definition:**\nEvaluates behavioral risk and trade ethics regarding labor and sub-contractors.\n\n**Ratings:**\n- **[1]**: Toxic / High Risk: History of site abandonment, aggression with vendors, using local influence to avoid dues.\n- **[2]**: Friction-Prone / Warning: Known for being ''clever'' with bills, finding small faults to deduct money.\n- **[3]**: Average / Neutral: Typical contractor, no major red flags, payments follow general market lag.\n- **[4]**: Strong / Reliable: Professional/ethical. Disputes settled quickly through dialogue.\n- **[5]**: Excellent / Role Model: Flawless standing, loyal workforce, closes vendor accounts without dispute.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '18274fdb-3e91-4061-a77c-9d208bfee3f4', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Contractor Reputation (Stage 3)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('f7c64b76-127c-4206-8088-209dc3619f64', '00000000-0000-0000-0000-000000000001', 'Contractor Reputation', 'contractor', 3, 'kam', 'grade_select', '4', '4', 'Lagging', 1.0, '**Definition:**\nEvaluates behavioral risk and trade ethics regarding labor and sub-contractors.\n\n**Ratings:**\n- **[1]**: Toxic / High Risk: History of site abandonment, aggression with vendors, using local influence to avoid dues.\n- **[2]**: Friction-Prone / Warning: Known for being ''clever'' with bills, finding small faults to deduct money.\n- **[3]**: Average / Neutral: Typical contractor, no major red flags, payments follow general market lag.\n- **[4]**: Strong / Reliable: Professional/ethical. Disputes settled quickly through dialogue.\n- **[5]**: Excellent / Role Model: Flawless standing, loyal workforce, closes vendor accounts without dispute.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', 'f7c64b76-127c-4206-8088-209dc3619f64', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: 3rd Party Vendor Check (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('672f4038-8b02-41ea-8d30-82fba1b1f287', '00000000-0000-0000-0000-000000000001', '3rd Party Vendor Check', 'contractor', 2, 'bdo', 'grade_select', '4', '4', 'Leading', 1.0, '**Definition:**\nHard evidence of B2B payment turnaround time with cement, steel, etc., suppliers.\n\n**Ratings:**\n- **[1]**: Toxic / High Risk: Known default history, unpaid dues, abandoned accounts.\n- **[2]**: Dispute-Prone / High-Medium Risk: History of renegotiating terms, unfairly holding back retention money.\n- **[3]**: Heavy Follow-up / Average: Pays, but requires significant effort and chasing.\n- **[4]**: Standard / Reliable: Good payment history, minor market delays, zero bad debt.\n- **[5]**: Flawless Payer / Ironclad: Exceptional financial discipline, never requires follow-ups.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '672f4038-8b02-41ea-8d30-82fba1b1f287', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: 3rd Party Vendor Check (Stage 3)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('28244595-a699-47d4-9405-d38c5ada6ea8', '00000000-0000-0000-0000-000000000001', '3rd Party Vendor Check', 'contractor', 3, 'rm', 'grade_select', '4', '4', 'Leading', 1.0, '**Definition:**\nHard evidence of B2B payment turnaround time with cement, steel, etc., suppliers.\n\n**Ratings:**\n- **[1]**: Toxic / High Risk: Known default history, unpaid dues, abandoned accounts.\n- **[2]**: Dispute-Prone / High-Medium Risk: History of renegotiating terms, unfairly holding back retention money.\n- **[3]**: Heavy Follow-up / Average: Pays, but requires significant effort and chasing.\n- **[4]**: Standard / Reliable: Good payment history, minor market delays, zero bad debt.\n- **[5]**: Flawless Payer / Ironclad: Exceptional financial discipline, never requires follow-ups.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '28244595-a699-47d4-9405-d38c5ada6ea8', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Credit Reason RCA (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('146c5aed-057c-4a3f-b8ae-cd3f03f827ea', '00000000-0000-0000-0000-000000000001', 'Credit Reason RCA', 'contractor', 1, 'rm', 'grade_select', '2', '2', 'Leading', 1.0, '**Definition:**\nRoot cause of cash gap (is capital deployed or depleted?).\n\n**Ratings:**\n- **[1]**: Structural Distress: Using material to finish a ''stuck'' site where budget is exhausted.\n- **[2]**: Project Delay / Mismatch: Contractor''s own client delayed payment, passing delay onto Tejas.\n- **[3]**: General Working Capital: Standard ''rotation'' request, keeping cash in hand for daily labor.\n- **[4]**: Standard Milestone Gap: Tied to a specific, verifiable project milestone payment from dependable client.\n- **[5]**: Expansion / Strategic: Spreading rotation thin across multiple active, premium sites.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '146c5aed-057c-4a3f-b8ae-cd3f03f827ea', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Credit Reason RCA (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('c8e5b6a0-8eda-4c86-9c80-e5b3810022f3', '00000000-0000-0000-0000-000000000001', 'Credit Reason RCA', 'contractor', 2, 'kam', 'grade_select', '2', '2', 'Leading', 1.0, '**Definition:**\nRoot cause of cash gap (is capital deployed or depleted?).\n\n**Ratings:**\n- **[1]**: Structural Distress: Using material to finish a ''stuck'' site where budget is exhausted.\n- **[2]**: Project Delay / Mismatch: Contractor''s own client delayed payment, passing delay onto Tejas.\n- **[3]**: General Working Capital: Standard ''rotation'' request, keeping cash in hand for daily labor.\n- **[4]**: Standard Milestone Gap: Tied to a specific, verifiable project milestone payment from dependable client.\n- **[5]**: Expansion / Strategic: Spreading rotation thin across multiple active, premium sites.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', 'c8e5b6a0-8eda-4c86-9c80-e5b3810022f3', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: RM Credit History PDCR (Amount Ratio) (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('7af08224-d203-4dfe-98c2-16b529f66275', '00000000-0000-0000-0000-000000000001', 'RM Credit History PDCR (Amount Ratio)', 'contractor', 1, 'accounts', 'grade_select', '3', '3', 'Lagging', 1.0, '**Definition:**\nMeasures the percentage of total loan value returned on time.<br>Formula: (Total Amount Returned on Time / Total Credit Issued) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '7af08224-d203-4dfe-98c2-16b529f66275', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: RM Credit History PDCR (Amount Ratio) (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('d6bf2920-86ac-4c86-b6a5-53dc3cd8998f', '00000000-0000-0000-0000-000000000001', 'RM Credit History PDCR (Amount Ratio)', 'contractor', 2, 'accounts', 'grade_select', '3', '3', 'Lagging', 1.0, '**Definition:**\nMeasures the percentage of total loan value returned on time.<br>Formula: (Total Amount Returned on Time / Total Credit Issued) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', 'd6bf2920-86ac-4c86-b6a5-53dc3cd8998f', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: RM Credit History Return Ratio (Count Ratio) (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('119f72cf-ecd0-4d51-90c1-0835b66481d2', '00000000-0000-0000-0000-000000000001', 'RM Credit History Return Ratio (Count Ratio)', 'contractor', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\nPercentage of credit instances settled within 7 days of the deadline.<br>Formula: (Number of Credits Returned within 7 Days / Total Number of Credits) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '119f72cf-ecd0-4d51-90c1-0835b66481d2', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: RM Credit History Avg. Days Late (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('0f47d637-3d1b-4c89-bc4c-6dac1982da15', '00000000-0000-0000-0000-000000000001', 'RM Credit History Avg. Days Late', 'contractor', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\nThe average number of days a borrower exceeds the agreed deadline.<br>Formula: Sum of Days Late / Total Number of Credits\n\n**Ratings:**\n- **[1]**: \n- **[2]**: 16+ Days\n- **[3]**: 8 - 15 Days\n- **[4]**: 1 - 7 Days\n- **[5]**: 0 Days', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '0f47d637-3d1b-4c89-bc4c-6dac1982da15', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Credit History PDCR (Amount Ratio) (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('7040a0f3-96c3-4142-8f79-9183a310b836', '00000000-0000-0000-0000-000000000001', 'Credit History PDCR (Amount Ratio)', 'contractor', 1, 'accounts', 'grade_select', '4', '3', 'Lagging', 1.0, '**Definition:**\nMeasures the percentage of total loan value returned on time.<br>Formula: (Total Amount Returned on Time / Total Credit Issued) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '7040a0f3-96c3-4142-8f79-9183a310b836', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Credit History PDCR (Amount Ratio) (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('c10b68f5-d55c-4a55-9eec-cbc4d295dd83', '00000000-0000-0000-0000-000000000001', 'Credit History PDCR (Amount Ratio)', 'contractor', 2, 'accounts', 'grade_select', '4', '3', 'Lagging', 1.0, '**Definition:**\nMeasures the percentage of total loan value returned on time.<br>Formula: (Total Amount Returned on Time / Total Credit Issued) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', 'c10b68f5-d55c-4a55-9eec-cbc4d295dd83', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Credit History Return Ratio (Count Ratio) (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('f7c18a7c-74b3-4361-9e74-7ab0d8c6a0dc', '00000000-0000-0000-0000-000000000001', 'Credit History Return Ratio (Count Ratio)', 'contractor', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\nPercentage of credit instances settled within 7 days of the deadline.<br>Formula: (Number of Credits Returned within 7 Days / Total Number of Credits) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', 'f7c18a7c-74b3-4361-9e74-7ab0d8c6a0dc', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Credit History Avg. Days Late (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('7c6bea2f-ea13-4a77-856b-dac18dd4cfb2', '00000000-0000-0000-0000-000000000001', 'Credit History Avg. Days Late', 'contractor', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\nThe average number of days a borrower exceeds the agreed deadline.<br>Formula: Sum of Days Late / Total Number of Credits\n\n**Ratings:**\n- **[1]**: \n- **[2]**: 16+ Days\n- **[3]**: 8 - 15 Days\n- **[4]**: 1 - 7 Days\n- **[5]**: 0 Days', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '7c6bea2f-ea13-4a77-856b-dac18dd4cfb2', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: GST / NON GST (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('eb0a1cf8-5ff3-4263-bacd-2f562fb92d05', '00000000-0000-0000-0000-000000000001', 'GST / NON GST', 'contractor', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\n\n\n**Ratings:**\n- **[1]**: \n- **[2]**: \n- **[3]**: \n- **[4]**: \n- **[5]**: ', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', 'eb0a1cf8-5ff3-4263-bacd-2f562fb92d05', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Occupation (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('9eb4f5a8-d934-42de-9ff4-b55767637576', '00000000-0000-0000-0000-000000000001', 'Occupation', 'customer', 1, 'rm', 'grade_select', '3', '2', 'Leading', 1.0, '**Definition:**\nMeasures cash flow predictability and financial discipline.\n\n**Ratings:**\n- **[1]**: Uncertain / High Risk: Unsteady cash flows, inherently risky business models, or visibly distressed businesses.\n- **[2]**: Fluctuating / High-Medium Risk: Income relies heavily on commissions, seasons, or gigs (lumpy income).\n- **[3]**: Average / Medium Risk: Income is steady but vulnerable to market changes (e.g., small shop owners, entry-level salaried).\n- **[4]**: Solid / Low Risk: Good job security with a steady salary, OR established business owners with solid fundamentals.\n- **[5]**: Bulletproof / High Discipline: Absolute job security, fixed high salary, or guaranteed pension.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '9eb4f5a8-d934-42de-9ff4-b55767637576', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Occupation (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('9ce356b3-4d82-4844-9892-c6e2642fdf45', '00000000-0000-0000-0000-000000000001', 'Occupation', 'customer', 2, 'rm', 'grade_select', '3', '2', 'Leading', 1.0, '**Definition:**\nMeasures cash flow predictability and financial discipline.\n\n**Ratings:**\n- **[1]**: Uncertain / High Risk: Unsteady cash flows, inherently risky business models, or visibly distressed businesses.\n- **[2]**: Fluctuating / High-Medium Risk: Income relies heavily on commissions, seasons, or gigs (lumpy income).\n- **[3]**: Average / Medium Risk: Income is steady but vulnerable to market changes (e.g., small shop owners, entry-level salaried).\n- **[4]**: Solid / Low Risk: Good job security with a steady salary, OR established business owners with solid fundamentals.\n- **[5]**: Bulletproof / High Discipline: Absolute job security, fixed high salary, or guaranteed pension.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '9ce356b3-4d82-4844-9892-c6e2642fdf45', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Religion/ Sub Group (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('f1681500-f15b-4f4c-ab8f-18d7e712eb98', '00000000-0000-0000-0000-000000000001', 'Religion/ Sub Group', 'customer', 1, 'rm', 'grade_select', '2', '1', 'Leading', 1.0, '**Definition:**\nMatches the customer to historical trade profiles and statistical payment trends.\n\n**Ratings:**\n- **[1]**: Historically High Risk: Statistical analysis shows the highest probability of default, prolonged delays.\n- **[2]**: Below Average / High-Medium Risk: Noticeable trend of delayed payments or renegotiation of terms.\n- **[3]**: Market Average / Medium Risk: Standard market behavior; occasional delays match industry average.\n- **[4]**: Strong History / Low Risk: Very low historical default rates; generally reliable.\n- **[5]**: Excellent History / Lowest Default Risk: Statistically proven highest repayment discipline; rare defaults.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'f1681500-f15b-4f4c-ab8f-18d7e712eb98', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Site Size & Scale (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('05fbacf2-5e2e-4023-86e0-9cecb5879dbb', '00000000-0000-0000-0000-000000000001', 'Site Size & Scale', 'customer', 1, 'rm', 'grade_select', '3', '2', 'Leading', 1.0, '**Definition:**\nEvaluates affordability and future business potential. Gauges true physical footprint.\n\n**Ratings:**\n- **[1]**: Micro / High Risk:<br>Under 1,000 sq. ft. Minor repairs, patchwork, or single-room renovations.\n- **[2]**: Small / Budgeted:<br>1,000 to 2,000 sq. ft. Tight budget constraints, unexpected costs could eat into material budget.\n- **[3]**: Medium / Standard: 2,000 to 4,000 sq. ft. Standard independent houses, full interiors for 3BHK/4BHK.\n- **[4]**: Large / High Value:<br>4,000 to 8,000 sq. ft. Independent large homes, mid-sized commercial spaces.\n- **[5]**: Premium / Massive Scale: 8,000+ sq. ft. projects, multi-story luxury bungalows, large-scale commercial.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '05fbacf2-5e2e-4023-86e0-9cecb5879dbb', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Site Size & Scale (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('0a833a0b-0d5c-4a34-a959-f22db06a05af', '00000000-0000-0000-0000-000000000001', 'Site Size & Scale', 'customer', 2, 'bdo', 'grade_select', '3', '2', 'Leading', 1.0, '**Definition:**\nEvaluates affordability and future business potential. Gauges true physical footprint.\n\n**Ratings:**\n- **[1]**: Micro / High Risk:<br>Under 1,000 sq. ft. Minor repairs, patchwork, or single-room renovations.\n- **[2]**: Small / Budgeted:<br>1,000 to 2,000 sq. ft. Tight budget constraints, unexpected costs could eat into material budget.\n- **[3]**: Medium / Standard: 2,000 to 4,000 sq. ft. Standard independent houses, full interiors for 3BHK/4BHK.\n- **[4]**: Large / High Value:<br>4,000 to 8,000 sq. ft. Independent large homes, mid-sized commercial spaces.\n- **[5]**: Premium / Massive Scale: 8,000+ sq. ft. projects, multi-story luxury bungalows, large-scale commercial.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '0a833a0b-0d5c-4a34-a959-f22db06a05af', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Customer Reputation (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('295a3671-2421-4f8b-8b7f-d5346467525b', '00000000-0000-0000-0000-000000000001', 'Customer Reputation', 'customer', 1, 'rm', 'grade_select', '4', '3', 'Lagging', 1.0, '**Definition:**\nAssesses behavioral risk and likelihood of dispute creation based on local standing.\n\n**Ratings:**\n- **[1]**: Hostile / High Risk: Known history of fights, public mishandling, or aggressive disputes with vendors.\n- **[2]**: Questionable / High-Medium Risk: Negative whispers exist. Known for being difficult, delaying labor payments.\n- **[3]**: Neutral / Unknown: No strong whispers either way, or customer entirely new to the locality.\n- **[4]**: Good / Reliable: Standard, positive reputation. No known history of public disputes.\n- **[5]**: Exceptional / Highly Respected: Spotless local reputation. Prominent figure, zero negative whispers.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '295a3671-2421-4f8b-8b7f-d5346467525b', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Customer Reputation (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('f142f641-89bc-458b-9243-a57c467266db', '00000000-0000-0000-0000-000000000001', 'Customer Reputation', 'customer', 2, 'bdo', 'grade_select', '4', '3', 'Lagging', 1.0, '**Definition:**\nAssesses behavioral risk and likelihood of dispute creation based on local standing.\n\n**Ratings:**\n- **[1]**: Hostile / High Risk: Known history of fights, public mishandling, or aggressive disputes with vendors.\n- **[2]**: Questionable / High-Medium Risk: Negative whispers exist. Known for being difficult, delaying labor payments.\n- **[3]**: Neutral / Unknown: No strong whispers either way, or customer entirely new to the locality.\n- **[4]**: Good / Reliable: Standard, positive reputation. No known history of public disputes.\n- **[5]**: Exceptional / Highly Respected: Spotless local reputation. Prominent figure, zero negative whispers.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'f142f641-89bc-458b-9243-a57c467266db', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Customer Reputation (Stage 3)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('a0d7cf15-59b7-4603-82cf-297b19d6f5b7', '00000000-0000-0000-0000-000000000001', 'Customer Reputation', 'customer', 3, 'kam', 'grade_select', '4', '3', 'Lagging', 1.0, '**Definition:**\nAssesses behavioral risk and likelihood of dispute creation based on local standing.\n\n**Ratings:**\n- **[1]**: Hostile / High Risk: Known history of fights, public mishandling, or aggressive disputes with vendors.\n- **[2]**: Questionable / High-Medium Risk: Negative whispers exist. Known for being difficult, delaying labor payments.\n- **[3]**: Neutral / Unknown: No strong whispers either way, or customer entirely new to the locality.\n- **[4]**: Good / Reliable: Standard, positive reputation. No known history of public disputes.\n- **[5]**: Exceptional / Highly Respected: Spotless local reputation. Prominent figure, zero negative whispers.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'a0d7cf15-59b7-4603-82cf-297b19d6f5b7', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Influencer Confidence (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('ae7f6f48-526d-4616-88dd-e363d7d7a85c', '00000000-0000-0000-0000-000000000001', 'Influencer Confidence', 'customer', 1, 'rm', 'grade_select', '3', '2', 'Leading', 1.0, '**Definition:**\nMeasures proxy reliability and identifies hidden personal agendas.\n\n**Ratings:**\n- **[1]**: Toxic / High Proxy Risk: Influencer has weak/bad track record OR actively trying to dump a bad Customer.\n- **[2]**: Self-Serving / Doubtful: Influencer pushing unusually hard; suspects hidden personal benefit (e.g., labor payout).\n- **[3]**: Neutral Intro / Hands-Off: Influencer introduces but steps back financially (won''t help recover money).\n- **[4]**: Strong Vouch / Reliable: Good Influencer confidently vouches for Customer based on past projects.\n- **[5]**: Absolute Proxy / Ironclad: Top-tier Influencer with flawless history takes full responsibility for Customer payment.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'ae7f6f48-526d-4616-88dd-e363d7d7a85c', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Influencer Confidence (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('8192fb72-11ce-4e90-a839-f3cc75e7cdf2', '00000000-0000-0000-0000-000000000001', 'Influencer Confidence', 'customer', 2, 'rm', 'grade_select', '3', '2', 'Leading', 1.0, '**Definition:**\nMeasures proxy reliability and identifies hidden personal agendas.\n\n**Ratings:**\n- **[1]**: Toxic / High Proxy Risk: Influencer has weak/bad track record OR actively trying to dump a bad Customer.\n- **[2]**: Self-Serving / Doubtful: Influencer pushing unusually hard; suspects hidden personal benefit (e.g., labor payout).\n- **[3]**: Neutral Intro / Hands-Off: Influencer introduces but steps back financially (won''t help recover money).\n- **[4]**: Strong Vouch / Reliable: Good Influencer confidently vouches for Customer based on past projects.\n- **[5]**: Absolute Proxy / Ironclad: Top-tier Influencer with flawless history takes full responsibility for Customer payment.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '8192fb72-11ce-4e90-a839-f3cc75e7cdf2', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: 3rd Party Vendor Check (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('b5fdaa13-ad3b-4581-bd91-2799c65cd1b1', '00000000-0000-0000-0000-000000000001', '3rd Party Vendor Check', 'customer', 2, 'rm', 'grade_select', '4', '4', 'Leading', 1.0, '**Definition:**\nUnbiased evidence of past invoice-to-payment turnaround time with other suppliers.\n\n**Ratings:**\n- **[1]**: Toxic / High Risk: Known default history. Vendors have unpaid dues, abandoned accounts.\n- **[2]**: Dispute-Prone / High-Medium Risk: History of renegotiating terms after delivery, unfairly holding money.\n- **[3]**: Heavy Follow-up / Average: Pays, but requires significant effort, multiple calls, and site visits.\n- **[4]**: Standard / Reliable: Good payment history. Minor standard delays, but zero bad debt.\n- **[5]**: Flawless Payer / Ironclad: Exceptional discipline. Pays exactly on promised date or in advance.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'b5fdaa13-ad3b-4581-bd91-2799c65cd1b1', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: 3rd Party Vendor Check (Stage 3)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('2bb2b7c1-fa91-4666-9088-8aeee1bf0f70', '00000000-0000-0000-0000-000000000001', '3rd Party Vendor Check', 'customer', 3, 'kam', 'grade_select', '4', '4', 'Leading', 1.0, '**Definition:**\nUnbiased evidence of past invoice-to-payment turnaround time with other suppliers.\n\n**Ratings:**\n- **[1]**: Toxic / High Risk: Known default history. Vendors have unpaid dues, abandoned accounts.\n- **[2]**: Dispute-Prone / High-Medium Risk: History of renegotiating terms after delivery, unfairly holding money.\n- **[3]**: Heavy Follow-up / Average: Pays, but requires significant effort, multiple calls, and site visits.\n- **[4]**: Standard / Reliable: Good payment history. Minor standard delays, but zero bad debt.\n- **[5]**: Flawless Payer / Ironclad: Exceptional discipline. Pays exactly on promised date or in advance.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '2bb2b7c1-fa91-4666-9088-8aeee1bf0f70', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Credit Reason RCA (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('8a09035e-96f5-4b8a-a4c7-ad542e7744da', '00000000-0000-0000-0000-000000000001', 'Credit Reason RCA', 'customer', 1, 'rm', 'grade_select', '2', '2', 'Leading', 1.0, '**Definition:**\nTests the logical truth and underlying reason behind why the customer cannot pay in advance.\n\n**Ratings:**\n- **[1]**: Severe Distress / Desperation: Client visibly out of money, juggling heavy debts, or covering other losses.\n- **[2]**: Mismatch / Warning Signs: Reason given does not match scale of project, indicates unexpected budget overruns.\n- **[3]**: Vague but Plausible: Reason makes general sense but lacks specific deadline (e.g., funds tied up elsewhere).\n- **[4]**: Standard Business Cycle: Normal, predictable delay (e.g., standard 30-day B2B cycle, waiting on reliable client).\n- **[5]**: Highly Secure / Documented Event: Gap is temporary, tied to guaranteed, highly secure event (approved bank loan).', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '8a09035e-96f5-4b8a-a4c7-ad542e7744da', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Credit Reason RCA (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('dcde3b4b-e7b3-4387-8b24-2b6e933869ab', '00000000-0000-0000-0000-000000000001', 'Credit Reason RCA', 'customer', 2, 'rm', 'grade_select', '2', '2', 'Leading', 1.0, '**Definition:**\nTests the logical truth and underlying reason behind why the customer cannot pay in advance.\n\n**Ratings:**\n- **[1]**: Severe Distress / Desperation: Client visibly out of money, juggling heavy debts, or covering other losses.\n- **[2]**: Mismatch / Warning Signs: Reason given does not match scale of project, indicates unexpected budget overruns.\n- **[3]**: Vague but Plausible: Reason makes general sense but lacks specific deadline (e.g., funds tied up elsewhere).\n- **[4]**: Standard Business Cycle: Normal, predictable delay (e.g., standard 30-day B2B cycle, waiting on reliable client).\n- **[5]**: Highly Secure / Documented Event: Gap is temporary, tied to guaranteed, highly secure event (approved bank loan).', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'dcde3b4b-e7b3-4387-8b24-2b6e933869ab', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Balance Sheet (Buisnesses) (Stage 3)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('d1ad5d4c-545f-45e7-827c-b07d77da87ab', '00000000-0000-0000-0000-000000000001', 'Balance Sheet (Buisnesses)', 'customer', 3, 'accounts', 'grade_select', '3', '4', 'Leading', 1.0, '**Definition:**\nMathematical audit measuring solvency, liquidity, and debt capacity.\n\n**Ratings:**\n- **[1]**: Distressed / High Risk: Practically insolvent, taking heavy losses, negative cash flow.\n- **[2]**: Stressed / High-Medium Risk: Declining revenue, high debt burden, over-leveraged, frequent overdrafts.\n- **[3]**: Average / Medium Risk: Functioning but tight margins, stagnant growth, noticeable but manageable debt.\n- **[4]**: Solid / Low Risk: Good, stable health, steady profits, healthy balance sheet.\n- **[5]**: Prime / Highly Liquid: Exceptional health, strong cash reserves, minimal debt, high margins.', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'd1ad5d4c-545f-45e7-827c-b07d77da87ab', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Customer PDCR (Amount Ratio) (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('8c2d4dc3-4390-42c5-981f-44795c5c9151', '00000000-0000-0000-0000-000000000001', 'Customer PDCR (Amount Ratio)', 'customer', 1, 'kam', 'grade_select', '4', '2', 'Lagging', 1.0, '**Definition:**\nMeasures the percentage of total loan value returned on time.<br>Formula: (Total Amount Returned on Time / Total Credit Issued) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '8c2d4dc3-4390-42c5-981f-44795c5c9151', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Customer PDCR (Amount Ratio) (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('ba02f8eb-3064-4042-a772-d7bf80b63e05', '00000000-0000-0000-0000-000000000001', 'Customer PDCR (Amount Ratio)', 'customer', 2, 'accounts', 'grade_select', '4', '2', 'Lagging', 1.0, '**Definition:**\nMeasures the percentage of total loan value returned on time.<br>Formula: (Total Amount Returned on Time / Total Credit Issued) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'ba02f8eb-3064-4042-a772-d7bf80b63e05', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Customer PDCR (Amount Ratio) (Stage 3)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('37b15aad-7194-4a72-8f24-5ec140da7713', '00000000-0000-0000-0000-000000000001', 'Customer PDCR (Amount Ratio)', 'customer', 3, 'accounts', 'grade_select', '4', '2', 'Lagging', 1.0, '**Definition:**\nMeasures the percentage of total loan value returned on time.<br>Formula: (Total Amount Returned on Time / Total Credit Issued) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '37b15aad-7194-4a72-8f24-5ec140da7713', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Customer Return Ratio (Count Ratio) (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('dcf511c7-3e36-43db-a8d8-e73d04f02c07', '00000000-0000-0000-0000-000000000001', 'Customer Return Ratio (Count Ratio)', 'customer', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\nPercentage of credit instances settled within 7 days of the deadline.<br>Formula: (Number of Credits Returned within 7 Days / Total Number of Credits) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'dcf511c7-3e36-43db-a8d8-e73d04f02c07', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: Customer Avg. Days Late (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('11870f04-31b1-4546-bd37-b1ad6d61f9cd', '00000000-0000-0000-0000-000000000001', 'Customer Avg. Days Late', 'customer', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\nThe average number of days a borrower exceeds the agreed deadline.<br>Formula: Sum of Days Late / Total Number of Credits\n\n**Ratings:**\n- **[1]**: \n- **[2]**: 16+ Days\n- **[3]**: 8 - 15 Days\n- **[4]**: 1 - 7 Days\n- **[5]**: 0 Days', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '11870f04-31b1-4546-bd37-b1ad6d61f9cd', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: RM Credit History PDCR (Amount Ratio) (Stage 2)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('d6bdc32e-ac4c-405e-9274-698e9b10bd71', '00000000-0000-0000-0000-000000000001', 'RM Credit History PDCR (Amount Ratio)', 'customer', 2, 'accounts', 'grade_select', '3', '2', 'Lagging', 1.0, '**Definition:**\nMeasures the percentage of total loan value returned on time.<br>Formula: (Total Amount Returned on Time / Total Credit Issued) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'd6bdc32e-ac4c-405e-9274-698e9b10bd71', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: RM Credit History PDCR (Amount Ratio) (Stage 3)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('61bbecd3-2ab1-4c40-9ce2-76fd7e185f0e', '00000000-0000-0000-0000-000000000001', 'RM Credit History PDCR (Amount Ratio)', 'customer', 3, 'accounts', 'grade_select', '3', '2', 'Lagging', 1.0, '**Definition:**\nMeasures the percentage of total loan value returned on time.<br>Formula: (Total Amount Returned on Time / Total Credit Issued) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '61bbecd3-2ab1-4c40-9ce2-76fd7e185f0e', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: RM Credit History Return Ratio (Count Ratio) (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('2957e621-d990-41ea-a8a7-06bcf8541da2', '00000000-0000-0000-0000-000000000001', 'RM Credit History Return Ratio (Count Ratio)', 'customer', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\nPercentage of credit instances settled within 7 days of the deadline.<br>Formula: (Number of Credits Returned within 7 Days / Total Number of Credits) * 100\n\n**Ratings:**\n- **[1]**: \n- **[2]**: Below 50%\n- **[3]**: 50% - 79%\n- **[4]**: 80% - 99%\n- **[5]**: 100%', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '2957e621-d990-41ea-a8a7-06bcf8541da2', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: RM Credit History Avg. Days Late (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('8c4c27b9-05d8-48f8-aa2c-62a8a7077a9a', '00000000-0000-0000-0000-000000000001', 'RM Credit History Avg. Days Late', 'customer', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\nThe average number of days a borrower exceeds the agreed deadline.<br>Formula: Sum of Days Late / Total Number of Credits\n\n**Ratings:**\n- **[1]**: \n- **[2]**: 16+ Days\n- **[3]**: 8 - 15 Days\n- **[4]**: 1 - 7 Days\n- **[5]**: 0 Days', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '8c4c27b9-05d8-48f8-aa2c-62a8a7077a9a', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;

-- Parameter: GST / Non GST (Stage 1)
INSERT INTO public.parameter_definitions (id, policy_version_id, name, subject_type, stage, default_owning_role, input_type, signal_strength, signal_cost, signal_lag, weight, rubric_guidance, is_active)
VALUES ('d32b3a44-ffd6-45b0-8fe4-a1e85fbc6511', '00000000-0000-0000-0000-000000000001', 'GST / Non GST', 'customer', 1, 'rm', 'grade_select', '', '', '', 1.0, '**Definition:**\n\n\n**Ratings:**\n- **[1]**: \n- **[2]**: \n- **[3]**: \n- **[4]**: \n- **[5]**: ', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rubric_guidance = EXCLUDED.rubric_guidance;
INSERT INTO public.weight_matrices (id, persona_id, parameter_id, weight)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'd32b3a44-ffd6-45b0-8fe4-a1e85fbc6511', 1.0) ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight;


-- 4. Create Score Bands
INSERT INTO public.score_bands (id, policy_version_id, band_name, min_score, max_score, approved_credit_days, is_ambiguity_band)
VALUES 
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Elite', 85, 100, 45, false),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Prime', 70, 84, 30, false),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Standard', 50, 69, 15, false),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Ambiguity', 40, 49, 0, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Rejected', 0, 39, 0, false);

-- 5. Set Stage Max Totals
INSERT INTO public.stage_max_totals (id, policy_version_id, stage, max_total)
VALUES 
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 1, 100),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 2, 100),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 3, 100)
ON CONFLICT (policy_version_id, stage) DO UPDATE SET max_total = EXCLUDED.max_total;

COMMIT;
