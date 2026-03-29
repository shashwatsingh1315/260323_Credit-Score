const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const caseId = '817825d1-e9a6-45cf-933a-7a04701265e2'; // We know this has tasks

  const { data: c, error: errC } = await supabase.from('credit_cases').select('status, substatus').eq('id', caseId).single();
  console.log("Case status:", c?.status);
}
run();
