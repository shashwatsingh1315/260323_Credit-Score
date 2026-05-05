-- M2: Add persistence_scope to parameter_definitions and create party_parameter_values table

ALTER TABLE parameter_definitions
  ADD COLUMN IF NOT EXISTS persistence_scope text NOT NULL DEFAULT 'none'
    CHECK (persistence_scope IN ('none', 'party', 'site', 'rm'));

COMMENT ON COLUMN parameter_definitions.persistence_scope IS
  'Determines whether a scored value is remembered: none = per-case only, party = persists to party profile, site = persists to site, rm = persists to RM';

-- Table to store persisted parameter values against a party
CREATE TABLE IF NOT EXISTS party_parameter_values (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id         uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  parameter_id     uuid NOT NULL REFERENCES parameter_definitions(id) ON DELETE CASCADE,
  grade_value      numeric,
  raw_input_value  text,
  captured_from_case uuid REFERENCES credit_cases(id) ON DELETE SET NULL,
  captured_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (party_id, parameter_id)
);

CREATE INDEX IF NOT EXISTS idx_ppv_party_id ON party_parameter_values(party_id);
CREATE INDEX IF NOT EXISTS idx_ppv_parameter_id ON party_parameter_values(parameter_id);

ALTER TABLE party_parameter_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON party_parameter_values FOR ALL TO authenticated USING (true) WITH CHECK (true);
