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
      // Let's verify parameter_definitions doesn't have a problem here
      .select('description, parameter:parameter_definitions(name, is_critical)')
      .eq('review_cycle_id', cycle.id)
      .eq('task_type', 'scoring')
      .is('grade_value', null);
    console.log("Tasks count here:", taskData?.length, "Error:", error);
  }
}
run();
