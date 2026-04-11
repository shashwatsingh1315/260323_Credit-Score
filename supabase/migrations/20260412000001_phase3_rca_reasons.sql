-- ============================================================
-- Phase 3 Migration 2: Reason for Credit dropdown values
-- Managed by founder_admin via Policy tab
-- ============================================================

-- Seed initial "reason_for_credit" values (admin can add more via UI)
INSERT INTO public.admin_enumerations (category, value, sort_order) VALUES
  ('reason_for_credit', 'Payment track record verified', 1),
  ('reason_for_credit', 'Strong collateral position', 2),
  ('reason_for_credit', 'Long-term business relationship', 3),
  ('reason_for_credit', 'Market segment priority', 4),
  ('reason_for_credit', 'Strategically important account', 5),
  ('reason_for_credit', 'Other', 99)
ON CONFLICT DO NOTHING;
