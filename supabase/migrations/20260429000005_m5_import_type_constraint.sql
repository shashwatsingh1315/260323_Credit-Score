-- M5: Extend import_jobs.import_type CHECK constraint to include 'parameter_bulk_values'
--     The original constraint only allowed: party_master, historical_exposure, outstanding_exposure.
--     The new import pipeline also needs to handle bulk parameter values.

-- Drop the old constraint (name may vary — find and drop by searching pg_constraint)
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'import_jobs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%import_type%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE import_jobs DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END;
$$;

-- Add the updated constraint
ALTER TABLE import_jobs
  ADD CONSTRAINT import_jobs_import_type_check
  CHECK (import_type IN ('party_master', 'historical_exposure', 'outstanding_exposure', 'parameter_bulk_values'));
