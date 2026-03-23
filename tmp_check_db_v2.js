
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Checking database content...');
  
  const { data: versions, error: vErr } = await supabase.from('policy_versions').select('id, version_label, is_active');
  if (vErr) console.error('Error policy_versions:', vErr.message);
  else console.log('Policy Versions:', versions);

  const { data: bands, error: bErr } = await supabase.from('score_bands').select('id, band_name, min_score, max_score');
  if (bErr) console.error('Error score_bands:', bErr.message);
  else console.log('Score Bands Count:', bands?.length || 0, bands);

  const { data: params, error: pErr } = await supabase.from('parameter_definitions').select('id, name');
  if (pErr) console.error('Error parameter_definitions:', pErr.message);
  else console.log('Parameters Count:', params?.length || 0);
}

check();
