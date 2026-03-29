const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: cycles, error } = await supabase.from('review_cycles').select('*, stage_tasks(*)');
  console.log("Cycles count:", cycles?.length, "Error:", error);
  if (cycles?.length > 0) {
      console.log(cycles[0]);
  }
}
run();
