-- Drop the existing constraint
ALTER TABLE public.parameter_definitions DROP CONSTRAINT parameter_definitions_input_type_check;

-- Add the new constraint with 'dropdown' included
ALTER TABLE public.parameter_definitions ADD CONSTRAINT parameter_definitions_input_type_check CHECK (input_type IN ('grade_select', 'numeric', 'yes_no', 'date', 'short_text', 'long_text', 'link_list', 'dropdown'));