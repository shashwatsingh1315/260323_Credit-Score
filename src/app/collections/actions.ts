"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

// Trigger an escalation manually
export async function handleEscalateCase(fd: FormData) {
  const caseId = fd.get('caseId') as string;
  const trancheIndex = parseInt(fd.get('trancheIndex') as string ?? '0', 10);
  if (!caseId) return;

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return;

  // 1. Find or create the escalation record for this case+tranche
  const { data: existingEscalation } = await supabase
    .from('escalations')
    .select('id, level')
    .eq('case_id', caseId)
    .eq('tranche_index', trancheIndex)
    .eq('status', 'open')
    .order('level', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextLevel = Math.min((existingEscalation?.level ?? 0) + 1, 3) as 1 | 2 | 3;

  // 2. Upsert escalation (create new level or escalate existing)
  const { data: escalation } = await supabase
    .from('escalations')
    .upsert({
      case_id: caseId,
      tranche_index: trancheIndex,
      level: nextLevel,
      status: 'open',
      trigger_reason: 'Manual escalation from collections dashboard',
      assigned_to: user.id,
    }, { onConflict: 'case_id,tranche_index,level' })
    .select('id')
    .single();

  // 3. Log the escalation action (uses correct escalation_logs schema)
  if (escalation?.id) {
    await supabase.from('escalation_logs').insert({
      escalation_id: escalation.id,
      logged_by: user.id,
      action_type: 'note',
      outcome: `Escalated to Level ${nextLevel} by ${user.full_name ?? 'unknown'}`,
      next_followup_at: null,
    });
  }

  // 4. Update the case-level summary column (added in M3)
  await supabase
    .from('credit_cases')
    .update({ escalation_level: nextLevel })
    .eq('id', caseId)
    .lt('escalation_level', nextLevel); // only bump up, never down

  revalidatePath('/collections');
  revalidatePath('/collections');
}

export async function bulkAssignRMs(fd: FormData) {
  const caseIds = JSON.parse(fd.get('caseIds') as string);
  const rmId = fd.get('rmId') as string;
  if (!caseIds.length || !rmId) return;

  const supabase = await createClient();
  await supabase.from('credit_cases').update({ rm_user_id: rmId }).in('id', caseIds);
  revalidatePath('/collections');
}

export async function addHqCollectionLog(fd: FormData) {
  const caseId = fd.get('caseId') as string;
  const message = fd.get('message') as string;
  const user = await getCurrentUser();
  if (!user || !caseId || !message) return;

  const supabase = await createClient();
  await supabase.from('hq_collection_logs').insert({
    case_id: caseId,
    logged_by: user.id,
    message
  });
  revalidatePath('/collections');
}
