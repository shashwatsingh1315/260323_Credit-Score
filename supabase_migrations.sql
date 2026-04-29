-- M1: Credit line limit on parties
ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS credit_line_amount BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS credit_line_set_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS credit_line_set_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

COMMENT ON COLUMN public.parties.credit_line_amount IS 'Manually set credit limit in rupees. NULL means no limit configured.';

-- M2a: Add persistence_scope to parameter_definitions
ALTER TABLE public.parameter_definitions
  ADD COLUMN IF NOT EXISTS persistence_scope TEXT NOT NULL DEFAULT 'none'
    CHECK (persistence_scope IN ('none', 'party', 'site', 'rm'));

COMMENT ON COLUMN public.parameter_definitions.persistence_scope IS
  'none=re-enter each case | party=stored per party | site=stored per site | rm=stored per RM';

-- M2b: Create party_parameter_values table
CREATE TABLE IF NOT EXISTS public.party_parameter_values (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id            UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  parameter_id        UUID NOT NULL REFERENCES public.parameter_definitions(id) ON DELETE CASCADE,
  grade_value         NUMERIC,
  raw_input_value     TEXT,
  captured_from_case  UUID REFERENCES public.credit_cases(id) ON DELETE SET NULL,
  captured_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (party_id, parameter_id)
);

CREATE INDEX IF NOT EXISTS idx_ppv_party_id     ON public.party_parameter_values(party_id);
CREATE INDEX IF NOT EXISTS idx_ppv_parameter_id ON public.party_parameter_values(parameter_id);

ALTER TABLE public.party_parameter_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppv_select" ON public.party_parameter_values FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ppv_write"  ON public.party_parameter_values FOR ALL    USING (auth.role() = 'authenticated');

-- M3: Add escalation_level column to credit_cases
ALTER TABLE public.credit_cases
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.credit_cases.escalation_level IS
  'Highest escalation level currently active on this case. 0 = none, 1 = KAM call, 2 = RM visit, 3 = legal notice.';

CREATE OR REPLACE VIEW public.escalation_thresholds AS
SELECT
  CASE key
    WHEN 'ESCALATION_L1_DAYS' THEN 1
    WHEN 'ESCALATION_L2_DAYS' THEN 2
    WHEN 'ESCALATION_L3_DAYS' THEN 3
  END AS escalation_level,
  value::integer AS days_threshold
FROM public.system_settings
WHERE key IN ('ESCALATION_L1_DAYS', 'ESCALATION_L2_DAYS', 'ESCALATION_L3_DAYS');

-- M4: Lock original tranche schedule at approval time
ALTER TABLE public.credit_cases
  ADD COLUMN IF NOT EXISTS original_tranches JSONB DEFAULT NULL;

COMMENT ON COLUMN public.credit_cases.original_tranches IS
  'Snapshot of proposed_tranches at the moment billing was first initialized. Never updated after first set. Used for restructure extension validation.';

-- M5: Add import_type check extension
ALTER TABLE public.import_jobs
  DROP CONSTRAINT IF EXISTS import_jobs_import_type_check;

ALTER TABLE public.import_jobs
  ADD CONSTRAINT import_jobs_import_type_check
    CHECK (import_type IN ('party_master', 'historical_exposure', 'outstanding_exposure', 'parameter_bulk_values'));

-- D5: Site ID Generation Race Condition Fix
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_cases_site_id
  ON public.credit_cases ((case_attributes->>'site_id'))
  WHERE case_attributes->>'site_id' IS NOT NULL;
