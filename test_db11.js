const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const caseId = '817825d1-e9a6-45cf-933a-7a04701265e2';

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('*')
    .eq('case_id', caseId)
    .eq('is_active', true)
    .single();

  if (cycle) {
    const { data: taskData, error } = await supabase
      .from('stage_tasks')
      // Try fetching name instead of description
      .select('*, assigned:profiles!stage_tasks_assigned_to_fkey(full_name), param:parameter_definitions!stage_tasks_parameter_id_fkey(default_owning_role, input_type, auto_band_config, name)')
      .eq('review_cycle_id', cycle.id)
      .order('stage').order('created_at');
    console.log("Tasks count with name instead of description:", taskData?.length, "Error:", error);
  }
}
run();
