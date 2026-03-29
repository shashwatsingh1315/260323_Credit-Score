const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: cases, error } = await supabase.from('credit_cases').select('*, review_cycles(*, stage_tasks(*))');
  console.log("Cases count:", cases?.length, "Error:", error);
  if (cases?.length > 0) {
      console.log("Case ID:", cases[0].id);
      console.log("Cycles:", cases[0].review_cycles.length);
  }
}
run();
