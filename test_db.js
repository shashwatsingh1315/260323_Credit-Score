const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: tasks, error } = await supabase.from('stage_tasks').select('*');
  console.log("Tasks count:", tasks?.length, "Error:", error);
  if (tasks?.length > 0) {
      console.log(tasks[0]);
  }
}
run();
