const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: cycles, error } = await supabase.from('review_cycles').select('*, stage_tasks(*)').eq('is_active', true);
  console.log("Cycles count:", cycles?.length, "Error:", error);
  if (cycles?.length > 0) {
      console.log("Tasks length:", cycles[0].stage_tasks.length);
  }
}
run();
