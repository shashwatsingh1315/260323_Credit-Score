const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  for (const u of users) {
     const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: u.email,
          password: 'password123'
      });
      if (data.session) {
         console.log("Logged in:", u.email);
         break;
      }

      const { data: d2, error: e2 } = await supabase.auth.signInWithPassword({
          email: u.email,
          password: 'Password123!'
      });
      if (d2.session) {
         console.log("Logged in:", u.email);
         break;
      }
  }
}
run();
