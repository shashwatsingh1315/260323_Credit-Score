const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  // force bypass RLS and create an admin manually with the service role key and set its password
  const email = "testing123@test.com";
  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password: 'password123!',
    email_confirm: true // bypass email confirmation
  });
  console.log("Created user:", user?.user?.email, "Error:", error?.message);

  if (user?.user) {
    const { data: profile } = await supabase.from('profiles').update({ roles: ['founder_admin'], full_name: 'Test Admin' }).eq('id', user.user.id);
    console.log("Updated profile roles");
  }
}
run();
