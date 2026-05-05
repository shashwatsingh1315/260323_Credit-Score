-- M1: Add manual credit line fields to parties table
ALTER TABLE parties
  ADD COLUMN IF NOT EXISTS credit_line_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS credit_line_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS credit_line_set_by uuid REFERENCES profiles(id);

COMMENT ON COLUMN parties.credit_line_amount IS 'Admin-set manual credit limit (null = no limit configured)';
COMMENT ON COLUMN parties.credit_line_set_at IS 'When the credit limit was last set';
COMMENT ON COLUMN parties.credit_line_set_by IS 'Admin user who last set the credit limit';
