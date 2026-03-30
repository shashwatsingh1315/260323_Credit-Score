-- ============================================================
-- Phase 2 Migration: Billing, Repayment & Margin Ledger
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Add billing columns to credit_cases
ALTER TABLE credit_cases
  ADD COLUMN IF NOT EXISTS billing_date          TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS decided_bill_amount   BIGINT,          -- integer rupees, no paise
  ADD COLUMN IF NOT EXISTS promised_bill_amount  BIGINT,          -- integer rupees, no paise
  ADD COLUMN IF NOT EXISTS actual_bill_amount    BIGINT NOT NULL DEFAULT 0;

-- 2. repayments — append-only payment ledger
CREATE TABLE IF NOT EXISTS repayments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES credit_cases(id) ON DELETE CASCADE,
  amount          BIGINT NOT NULL CHECK (amount > 0),             -- whole rupees only
  payment_date    DATE NOT NULL,
  reference_url   TEXT,
  description     TEXT,
  logged_by       UUID REFERENCES profiles(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repayments_case_id ON repayments(case_id);
CREATE INDEX IF NOT EXISTS idx_repayments_payment_date ON repayments(payment_date);

-- 3. credit_notes — approved reductions to decided/promised amounts
CREATE TABLE IF NOT EXISTS credit_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID NOT NULL REFERENCES credit_cases(id) ON DELETE CASCADE,
  reduction_amount  BIGINT NOT NULL CHECK (reduction_amount > 0),
  reason            TEXT NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  logged_by         UUID REFERENCES profiles(id),
  approved_by       UUID REFERENCES profiles(id),
  resolved_at       TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_case_id ON credit_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(status);

-- 4. system_settings — admin-tunable global constants
CREATE TABLE IF NOT EXISTS system_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       NUMERIC NOT NULL,
  description TEXT,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by  UUID REFERENCES profiles(id)
);

-- Seed default settings (INSERT, not UPSERT, so they don't overwrite admin changes on re-run)
INSERT INTO system_settings(key, value, description)
VALUES
  ('WRITE_OFF_SLIPPAGE_PERCENTAGE', 10,  'Max % gap between Actual and Promised before triggering Write-Off approval'),
  ('MAX_TRANCHE_EXTENSION_DAYS',    30,  'Maximum days a KAM can extend a tranche due date from its original date')
ON CONFLICT (key) DO NOTHING;

-- 5. Trigger: auto-sync actual_bill_amount from repayments
CREATE OR REPLACE FUNCTION sync_actual_bill_amount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE credit_cases
  SET    actual_bill_amount = COALESCE(
           (SELECT SUM(amount) FROM repayments WHERE case_id = COALESCE(NEW.case_id, OLD.case_id)),
           0
         )
  WHERE  id = COALESCE(NEW.case_id, OLD.case_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_actual_bill_amount ON repayments;
CREATE TRIGGER trg_sync_actual_bill_amount
AFTER INSERT OR UPDATE OR DELETE ON repayments
FOR EACH ROW EXECUTE FUNCTION sync_actual_bill_amount();

-- 6. Enable Row-Level Security
ALTER TABLE repayments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Repayments: readable by all authenticated, writable by kam/founder_admin
CREATE POLICY "repayments_select" ON repayments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "repayments_insert" ON repayments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('kam', 'founder_admin')
    )
  );

CREATE POLICY "repayments_update" ON repayments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('kam', 'founder_admin')
    )
  );

CREATE POLICY "repayments_delete" ON repayments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('kam', 'founder_admin')
    )
  );

-- Credit notes: readable by all, writable by kam/rm for insert, founder_admin for approval
CREATE POLICY "credit_notes_select" ON credit_notes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "credit_notes_insert" ON credit_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('kam', 'rm', 'founder_admin')
    )
  );

CREATE POLICY "credit_notes_update" ON credit_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('founder_admin')
    )
  );

-- System settings: founder_admin only
CREATE POLICY "settings_select" ON system_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "settings_update" ON system_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'founder_admin'
    )
  );
