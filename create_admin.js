const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error("No Supabase key found in environment variables. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log("=== CreditFlow Admin User Creator ===");
  console.log("Using Supabase URL:", supabaseUrl);

  rl.question("Enter Admin Email (e.g., admin@example.com): ", async (email) => {
    rl.question("Enter Admin Password (min 6 chars): ", async (password) => {
      rl.question("Enter Admin Full Name: ", async (fullName) => {

        console.log("\nCreating user...");

        let newUserId;
        // If we have a service role key, we can use the admin API
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
          });

          if (error) {
            console.error("Error creating user via Admin API:", error.message);
            rl.close();
            return;
          }
          console.log("User created via Admin API!");
          newUserId = data.user.id;
        } else {
          // Otherwise use standard signUp
          console.log("No SERVICE_ROLE_KEY found, falling back to standard signUp...");
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName }
            }
          });

          if (error) {
            console.error("Error signing up user:", error.message);
            rl.close();
            return;
          }
          console.log("User signed up successfully! Note: You may need to verify email if enabled in Supabase.");
          if (!data.user) {
             console.error("No user object returned. Ensure email confirmations are disabled if you want immediate access.");
             rl.close();
             return;
          }
          newUserId = data.user.id;
        }

        console.log("User ID:", newUserId);

        // Upsert profile
        console.log("Setting up profile...");
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: newUserId,
          full_name: fullName,
          email: email
        });

        if (profileError) {
          console.warn("Profile setup issue (might already be created by trigger):", profileError.message);
        }

        // Grant founder_admin role
        console.log("Granting founder_admin role...");
        const { error: roleError } = await supabase.from('user_roles').upsert({
          user_id: newUserId,
          role: 'founder_admin'
        });

        if (roleError) {
          console.error("Failed to assign role. RLS might be preventing this if not using Service Role Key:", roleError.message);
          console.log("If this fails, log into Supabase Dashboard and manually insert the role.");
        } else {
          console.log("Role assigned successfully!");
        }

        console.log("\nDone! You can now log into the app.");
        rl.close();
      });
    });
  });
}

main();
