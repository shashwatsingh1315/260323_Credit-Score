-- ============================================================
-- Phase 3 Migration 1: Parameter SLA and Reasoning enforcement
-- ============================================================

-- Add require_reasoning and sla_days to parameter_definitions
ALTER TABLE public.parameter_definitions
  ADD COLUMN IF NOT EXISTS require_reasoning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_days integer; -- NULL = no SLA for this parameter

-- Add delay_reason to stage_tasks (stored when task completed late)
ALTER TABLE public.stage_tasks
  ADD COLUMN IF NOT EXISTS delay_reason text;

-- Seed initial delay reasons into admin_enumerations
-- Note: admin_enumerations already has category + value + is_active + sort_order
INSERT INTO public.admin_enumerations (category, value, sort_order) VALUES
  ('delay_reason', 'Awaiting customer documentation', 1),
  ('delay_reason', 'Field visit scheduling conflict', 2),
  ('delay_reason', 'Internal review backlog', 3),
  ('delay_reason', 'Awaiting third-party data', 4),
  ('delay_reason', 'Public holiday or weekend', 5),
  ('delay_reason', 'Customer unavailable', 6),
  ('delay_reason', 'Other', 99)
ON CONFLICT DO NOTHING;
