"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, hasAnyRole } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

// Trigger an escalation manually
export async function handleEscalateCase(fd: FormData) {
  const caseId = fd.get('caseId') as string;
  const targetRole = fd.get('targetRole') as string;
  if (!caseId || !targetRole) return;

  const supabase = await createClient();

  const user = await getCurrentUser();
  if (!user || !hasAnyRole(user, ['kam', 'accounts', 'founder_admin'])) {
    throw new Error('Unauthorized to escalate cases');
  }


  const { data: c } = await supabase.from('credit_cases').select('escalation_level').eq('id', caseId).single();
  
  if (c) {
    const currentLevel = c.escalation_level ?? 0;
    await supabase.from('credit_cases').update({ escalation_level: currentLevel + 1 }).eq('id', caseId);

    if (user?.id) {
      await supabase.from('escalations').insert({
        case_id: caseId,
        assigned_to: null, // to be picked up
        escalation_reason: 'Manual escalation initiated from collections dashboard: ' + targetRole,
        status: 'open'
      });
    }
  }

  revalidatePath('/collections');
}

