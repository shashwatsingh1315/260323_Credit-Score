const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: cases, error } = await supabase.from('credit_cases').select('*, review_cycles(*, stage_tasks(*))').eq('status', 'In Review');
  console.log("In Review Cases count:", cases?.length, "Error:", error);
  if (cases?.length > 0) {
      console.log(cases[0].id);
  }
}
run();
