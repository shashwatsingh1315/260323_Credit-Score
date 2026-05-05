import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyInsertion() {
  console.log('--- RUNNING ACTUAL DB INSERTION TEST (1 ROW) ---');
  
  // 1. Get a valid party and profile to use for testing
  const { data: party } = await supabase.from('parties').select('id').limit(1).single();
  const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();

  if (!party || !profile) {
    console.error('Could not find a party or profile to test with.');
    return;
  }

  const testCase = {
    customer_party_id: party.id,
    case_scenario: 'customer_name_customer_pays',
    rm_user_id: profile.id,
    status: 'Billing Active',
    billing_date: new Date().toISOString(),
    decided_bill_amount: 1000,
    actual_bill_amount: 0,
    proposed_tranches: [{"type": "percentage", "value": 100, "days_after_billing": 0}],
    case_number: `TEST-VERIFY-${Date.now()}`
  };

  // 2. Attempt insertion
  const { data, error } = await supabase.from('credit_cases').insert(testCase).select('id').single();

  if (error) {
    console.error('FAILED TO INSERT:', error.message);
    process.exit(1);
  } else {
    console.log('SUCCESSFULLY INSERTED TEST ROW ID:', data.id);
    
    // 3. Clean up
    await supabase.from('credit_cases').delete().eq('id', data.id);
    console.log('CLEANED UP TEST ROW.');
  }
}

verifyInsertion().catch(console.error);
