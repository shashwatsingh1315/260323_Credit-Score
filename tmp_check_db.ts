import { createClient } from './src/utils/supabase/server';

async function check() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('parameter_definitions').select('id, name, subject_type');
  console.log('--- Parameter Definitions ---');
  if (error) {
    console.error('Error fetching parameters:', error.message);
  } else {
    console.log(`Found ${data.length} parameters.`);
    data.forEach(p => console.log(`- ${p.name} (${p.subject_type})`));
  }
}

check();
