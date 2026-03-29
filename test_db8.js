const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  console.log("Users count:", users?.users?.length, "Error:", error);
  if (users?.users?.length > 0) {
      for (const u of users.users) {
          console.log(u.email);
      }
  }
}
run();
