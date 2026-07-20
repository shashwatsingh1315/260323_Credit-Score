import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: policies, error } = await supabase.from('policy_versions').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  for (const policy of policies) {
    const { data: params, error: pError } = await supabase.from('parameter_definitions').select('id, name').eq('policy_version_id', policy.id);
    
    const { data: cycles, error: cError } = await supabase.from('review_cycles').select('id').eq('policy_snapshot_id', policy.id);
    
    let taskCount = 0;
    if (cycles && cycles.length > 0) {
      const cycleIds = cycles.map(c => c.id);
      const { data: tasks, error: tError } = await supabase.from('stage_tasks').select('id').in('review_cycle_id', cycleIds);
      if (tasks) {
        taskCount = tasks.length;
      }
    }
    
    console.log(`Policy: ${policy.version_label} (ID: ${policy.id})`);
    console.log(`  - Parameter Definitions: ${params ? params.length : 0}`);
    console.log(`  - Stage Tasks: ${taskCount}`);
    if ((!params || params.length === 0) && taskCount === 0) {
        console.log(`  => EMPTY in terms of tasks/parameters!`);
    }
  }
}

check().catch(console.error);
