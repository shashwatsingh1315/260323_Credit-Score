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
      for (const cycle of c.review_cycles) {
          console.log(`  Cycle ID: ${cycle.id}, is_active: ${cycle.is_active}, tasks length: ${cycle.stage_tasks.length}`);
      }
  }
}
run();
