# Database Migration Needed

To complete the role-based case field permissions implementation (Scoring Parameters), you must apply the following SQL to your Supabase project:

```sql
-- Add allowed_roles to scoring parameters to restrict who can fill out a specific parameter
ALTER TABLE scoring_parameters
ADD COLUMN IF NOT EXISTS allowed_roles text[] DEFAULT '{}';

-- Example of how to populate this (run this or update via UI):
-- UPDATE scoring_parameters SET allowed_roles = '{"rm"}' WHERE parameter_name = 'some_rm_specific_field';
-- UPDATE scoring_parameters SET allowed_roles = '{"kam", "accounts"}' WHERE parameter_name = 'financial_health';
```

Without this column, the application will fallback to allowing any role to fill the task (or strictly `founder_admin` if preferred).
