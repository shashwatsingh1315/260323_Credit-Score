-- M3: Add escalation_level to credit_cases; create escalations + escalation_logs tables;
--     create escalation_thresholds VIEW from system_settings

-- 1. Add escalation_level to credit_cases
ALTER TABLE credit_cases
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN credit_cases.escalation_level IS
  'Current escalation depth: 0 = not escalated, 1 = escalated to L1, 2 = L2, etc.';

-- 2. Ensure system_settings has the escalation threshold rows.
--    These seed rows are inserted only when the keys don't already exist.
INSERT INTO system_settings (key, value, description)
VALUES
  ('ESCALATION_L1_DAYS', 7,  'Days overdue before auto-escalation to Level 1'),
  ('ESCALATION_L2_DAYS', 15, 'Days overdue before auto-escalation to Level 2'),
  ('ESCALATION_L3_DAYS', 30, 'Days overdue before auto-escalation to Level 3')
ON CONFLICT (key) DO NOTHING;

-- 3. Escalation_thresholds VIEW — consumed by collections/page.tsx
CREATE OR REPLACE VIEW escalation_thresholds AS
SELECT
  CASE key
    WHEN 'ESCALATION_L1_DAYS' THEN 1
    WHEN 'ESCALATION_L2_DAYS' THEN 2
    WHEN 'ESCALATION_L3_DAYS' THEN 3
  END AS escalation_level,
  value::integer AS days_overdue_threshold,
  CASE key
    WHEN 'ESCALATION_L1_DAYS' THEN 'kam'
    WHEN 'ESCALATION_L2_DAYS' THEN 'ordinary_approver'
    WHEN 'ESCALATION_L3_DAYS' THEN 'founder_admin'
  END AS escalate_to_role
FROM system_settings
WHERE key IN ('ESCALATION_L1_DAYS', 'ESCALATION_L2_DAYS', 'ESCALATION_L3_DAYS');

-- 4. escalations table: one row per case-tranche-escalation-level
CREATE TABLE IF NOT EXISTS escalations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        uuid NOT NULL REFERENCES credit_cases(id) ON DELETE CASCADE,
  tranche_index  integer NOT NULL DEFAULT 0,
  level          integer NOT NULL DEFAULT 1,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'escalated_further')),
  assigned_to    text,           -- role name e.g. 'kam', 'ordinary_approver'
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (case_id, tranche_index, level)
);

CREATE INDEX IF NOT EXISTS idx_escalations_case_id ON escalations(case_id);

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON escalations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. escalation_logs table: audit trail of each escalation action
CREATE TABLE IF NOT EXISTS escalation_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id  uuid NOT NULL REFERENCES escalations(id) ON DELETE CASCADE,
  logged_by      uuid NOT NULL REFERENCES profiles(id),
  action_type    text NOT NULL,  -- e.g. 'escalated', 'resolved', 'noted'
  outcome        text,
  next_followup_at timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_logs_escalation_id ON escalation_logs(escalation_id);

ALTER TABLE escalation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON escalation_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
