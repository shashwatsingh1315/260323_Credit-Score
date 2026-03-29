const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: cases, error } = await supabase.from('credit_cases').select('*, review_cycles(*, stage_tasks(*))');
  console.log("Cases count:", cases?.length, "Error:", error);
  for (const c of cases) {
      console.log(`Case ID: ${c.id}`);
      let hasTasks = false;
      for (const cycle of c.review_cycles) {
          if (cycle.is_active) {
            console.log(`  Active Cycle ID: ${cycle.id}, tasks length: ${cycle.stage_tasks.length}`);
            hasTasks = cycle.stage_tasks.length > 0;
            if (hasTasks) {
              console.log(`  First task: ${cycle.stage_tasks[0].id} (Stage ${cycle.stage_tasks[0].stage})`);
            }
          }
      }
      if (!hasTasks) {
         console.log(`  Case ${c.id} has no tasks in its active cycle.`);
      }
  }
}
run();
