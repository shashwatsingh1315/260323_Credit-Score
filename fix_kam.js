const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: user } = await supabase.from('profiles').select('id').eq('email', 'kam@tejas.network').single();
  if (user) {
    await supabase.from('user_roles').update({ role: 'kam' }).eq('user_id', user.id);
    console.log("Updated kam@tejas.network to have role KAM");
  } else {
    console.log("Could not find kam@tejas.network");
  }
}
main();
