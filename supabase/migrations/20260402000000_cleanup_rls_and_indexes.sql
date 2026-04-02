-- 1. Unique Email Constraint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- 2. Indexes for Foreign Keys
CREATE INDEX idx_credit_cases_rm ON credit_cases(rm_user_id);
CREATE INDEX idx_credit_cases_kam ON credit_cases(kam_user_id);
CREATE INDEX idx_approval_decisions_approver ON approval_decisions(approver_id);

-- 3. Billing Trigger for actual_bill_amount
CREATE OR REPLACE FUNCTION sync_actual_bill_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.credit_cases
  SET actual_bill_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.repayments
    WHERE case_id = COALESCE(NEW.case_id, OLD.case_id)
  )
  WHERE id = COALESCE(NEW.case_id, OLD.case_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_actual_bill_amount_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.repayments
FOR EACH ROW EXECUTE FUNCTION sync_actual_bill_amount();

-- RLS Updates
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.credit_cases;

CREATE POLICY "RM and KAM read cases" ON public.credit_cases
  FOR SELECT USING (auth.uid() = rm_user_id OR auth.uid() = kam_user_id OR (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'founder_admin');
