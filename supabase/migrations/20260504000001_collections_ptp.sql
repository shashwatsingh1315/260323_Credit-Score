-- Migration: Add PTP and tracking fields to escalations

BEGIN;

-- 1. Drop existing status constraint
ALTER TABLE public.escalations DROP CONSTRAINT IF EXISTS escalations_status_check;

-- 2. Update existing 'open' statuses to 'active'
UPDATE public.escalations SET status = 'active' WHERE status = 'open';

-- 3. Add new columns
ALTER TABLE public.escalations 
  ADD COLUMN IF NOT EXISTS ptp_date DATE,
  ADD COLUMN IF NOT EXISTS last_hq_update_at TIMESTAMPTZ DEFAULT now();

-- 4. Add the new constraint
ALTER TABLE public.escalations 
  ADD CONSTRAINT escalations_status_check 
  CHECK (status IN ('active', 'snoozed', 'resolved', 'broken_promise', 'escalated_to_next'));

-- 5. Create an RPC to refresh PTP statuses (move snoozed to broken_promise if date passed)
CREATE OR REPLACE FUNCTION refresh_ptp_statuses()
RETURNS void AS $$
BEGIN
  UPDATE public.escalations
  SET status = 'broken_promise'
  WHERE status = 'snoozed' AND ptp_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;