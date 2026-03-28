const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kpeqfpqyjnrgjzcslrvq.supabase.co';
const supabaseKey = 'sb_secret_eBWhYT2wd36lofJMzNtOCQ_9BYngfcO';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('parameter_definitions').select('*');
  console.log("Existing parameters count:", data?.length);
  if (data) {
    console.log("Sample parameter:", data[0]);
  }
}

test();
