-- Migration: 20260505000000_tighten_ppv_rls.sql
-- Purpose: Restrict write access to party_parameter_values to KAM and Admin only.
-- Previously, any authenticated user could insert/update/delete rows in this table.

-- Drop any existing permissive write policy if one exists
DROP POLICY IF EXISTS "ppv_all_auth" ON party_parameter_values;

-- Allow all authenticated users to READ (needed for case scoring calculations)
CREATE POLICY "ppv_read"
  ON party_parameter_values
  FOR SELECT
  TO authenticated
  USING (true);

-- Only KAM and Founder Admin can write (insert, update, delete)
CREATE POLICY "ppv_write"
  ON party_parameter_values
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('kam', 'founder_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('kam', 'founder_admin')
    )
  );
