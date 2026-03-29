const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (users?.length > 0) {
      console.log(users[0].email);
      // maybe try to login with this user using the JS client
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: users[0].email,
          password: 'password' // most test users use 'password'
      });
      console.log("Login result:", !!data.session, "Error:", signInError?.message);
  }
}
run();
