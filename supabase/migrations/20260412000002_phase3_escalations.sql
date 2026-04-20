-- ============================================================
-- Phase 3 Migration 3: Collections & Escalations Module
-- ============================================================

-- Admin-configurable escalation thresholds
-- These live in system_settings. Add two new keys:
INSERT INTO system_settings (key, value, description)
VALUES
  ('ESCALATION_L1_DAYS', 1,   'Days overdue before Level 1 escalation (KAM call) is auto-created'),
  ('ESCALATION_L2_DAYS', 7,   'Days overdue before Level 2 escalation (RM visit) is triggered'),
  ('ESCALATION_L3_DAYS', 30,  'Days overdue before Level 3 escalation (Legal notice) is triggered')
ON CONFLICT (key) DO NOTHING;

-- Escalation records: one escalation per tranche breach event
CREATE TABLE IF NOT EXISTS public.escalations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          uuid NOT NULL REFERENCES public.credit_cases(id) ON DELETE CASCADE,
  tranche_index    integer NOT NULL,           -- which tranche (0-based)
  overdue_days     integer NOT NULL DEFAULT 0,
  overdue_amount   bigint NOT NULL DEFAULT 0,   -- rupees outstanding for this tranche
  level            integer NOT NULL DEFAULT 1 CHECK (level IN (1, 2, 3)),
  status           text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'resolved', 'escalated_to_next')),
  assigned_to      uuid REFERENCES public.profiles(id),  -- KAM assigned to this escalation
  trigger_reason   text,                        -- auto-generated description
  resolved_at      timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (case_id, tranche_index, level)       -- one escalation per tranche per level
);

-- Escalation logs: call/visit outcome records
CREATE TABLE IF NOT EXISTS public.escalation_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id    uuid NOT NULL REFERENCES public.escalations(id) ON DELETE CASCADE,
  logged_by        uuid NOT NULL REFERENCES public.profiles(id),
  action_type      text NOT NULL CHECK (action_type IN ('call', 'visit', 'note')),
  outcome          text NOT NULL,              -- free text: what happened
  next_followup_at date,                       -- optional next follow-up date
  created_at       timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalations_select"  ON public.escalations     FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "escalations_write" ON public.escalations     FOR ALL    USING (auth.uid() IS NOT NULL);
CREATE POLICY "escalation_logs_select"  ON public.escalation_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "escalation_logs_write" ON public.escalation_logs FOR ALL    USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_escalations_case_id  ON public.escalations(case_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status   ON public.escalations(status);
CREATE INDEX IF NOT EXISTS idx_esclog_escalation_id ON public.escalation_logs(escalation_id);
