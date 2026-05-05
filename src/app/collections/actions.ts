"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

// Trigger an escalation manually
export async function handleEscalateCase(fd: FormData) {
  const caseId = fd.get('caseId') as string;
  const targetRole = fd.get('targetRole') as string;
  if (!caseId || !targetRole) return;

  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: c } = await supabase.from('credit_cases').select('escalation_level').eq('id', caseId).single();
  
  if (c) {
    const currentLevel = c.escalation_level ?? 0;
    await supabase.from('credit_cases').update({ escalation_level: currentLevel + 1 }).eq('id', caseId);

    if (user?.id) {
      await supabase.from('escalation_logs').insert({
        case_id: caseId,
        escalated_by: user.id,
        target_role: targetRole,
        reason: 'Manual escalation initiated from collections dashboard'
      });
    }
  }

  revalidatePath('/collections');
}

export async function refreshPtpStatuses() {
  const supabase = await createClient();
  await supabase.rpc('refresh_ptp_statuses');
}

export async function logUpdate(caseId: string, escalationId: string, outcome: string, actionType: 'call' | 'visit' | 'note' = 'note') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const supabase = await createClient();
  
  await supabase.from('escalation_logs').insert({
    escalation_id: escalationId,
    logged_by: user.id,
    action_type: actionType,
    outcome: outcome
  });

  await supabase.from('escalations').update({
    last_hq_update_at: new Date().toISOString()
  }).eq('id', escalationId);

  revalidatePath('/collections');
}

export async function snoozeCase(caseId: string, escalationId: string, ptpDate: string, reason: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const supabase = await createClient();
  
  await supabase.from('escalation_logs').insert({
    escalation_id: escalationId,
    logged_by: user.id,
    action_type: 'note',
    outcome: `PTP Set for ${ptpDate}: ${reason}`
  });

  await supabase.from('escalations').update({
    status: 'snoozed',
    ptp_date: ptpDate,
    last_hq_update_at: new Date().toISOString()
  }).eq('id', escalationId);

  revalidatePath('/collections');
}
