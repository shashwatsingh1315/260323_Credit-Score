-- Create HQ Collection Logs table
CREATE TABLE public.hq_collection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.credit_cases(id) ON DELETE CASCADE,
    logged_by UUID NOT NULL REFERENCES public.profiles(id),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hq_logs_case ON public.hq_collection_logs(case_id);

ALTER TABLE public.hq_collection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hq_logs_select" ON public.hq_collection_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "hq_logs_insert" ON public.hq_collection_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add Bill File URL to credit_cases
ALTER TABLE public.credit_cases 
ADD COLUMN IF NOT EXISTS bill_file_url TEXT;

-- Update Import Jobs constraints to allow grandfathered_cases
ALTER TABLE public.import_jobs DROP CONSTRAINT IF EXISTS import_jobs_import_type_check;
ALTER TABLE public.import_jobs ADD CONSTRAINT import_jobs_import_type_check 
CHECK (import_type IN ('party_master', 'historical_exposure', 'outstanding_exposure', 'parameter_bulk_values', 'grandfathered_cases'));
