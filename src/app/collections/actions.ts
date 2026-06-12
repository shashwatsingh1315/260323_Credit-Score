"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, hasAnyRole } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

// Trigger an escalation manually
export async function handleEscalateCase(fd: FormData) {
  const caseId = fd.get('caseId') as string;
  const trancheIndex = parseInt((fd.get('trancheIndex') as string) || '0', 10);
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

export async function bulkAssignRMs(fd: FormData) {
  const caseIds = JSON.parse(fd.get('caseIds') as string);
  const rmId = fd.get('rmId') as string;
  if (!caseIds.length || !rmId) return;

  const user = await getCurrentUser();
  if (!user) return;
  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can bulk-assign RMs.');
  }

  const supabase = await createClient();
  await supabase.from('credit_cases').update({ rm_user_id: rmId }).in('id', caseIds);
  revalidatePath('/collections');
}

// Structured contact log. Optionally records a promise-to-pay (PTP):
// the PTP is embedded in the log message as a parseable marker line and
// mirrored onto the case's escalation (status 'snoozed' + ptp_date) so the
// existing PTP machinery (refresh_ptp_statuses, PTP-due-today) tracks it.
export async function addHqCollectionLog(fd: FormData) {
  const caseId = fd.get('caseId') as string;
  const rawMessage = ((fd.get('message') as string) || '').trim();
  const contactType = ((fd.get('contactType') as string) || 'note') as 'call' | 'visit' | 'note';
  const ptpDate = (fd.get('ptpDate') as string) || null;
  const ptpAmountRaw = (fd.get('ptpAmount') as string) || '';
  const trancheIndex = parseInt((fd.get('trancheIndex') as string) || '0', 10);

  const user = await getCurrentUser();
  if (!user || !caseId) return;
  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can log HQ collection notes.');
  }
  if (!rawMessage && !ptpDate) return;

  const ptpAmount = ptpAmountRaw ? parseInt(ptpAmountRaw.replace(/[^\d]/g, ''), 10) : null;

  let message = rawMessage || `Promised to pay${ptpAmount ? ` ₹${ptpAmount.toLocaleString('en-IN')}` : ''} by ${ptpDate}`;
  if (contactType !== 'note') message = `[${contactType}] ${message}`;
  if (ptpDate) message += `\n[PTP ${ptpDate}${ptpAmount ? ` ₹${ptpAmount.toLocaleString('en-IN')}` : ''}]`;

  const supabase = await createClient();
  await supabase.from('hq_collection_logs').insert({
    case_id: caseId,
    logged_by: user.id,
    message,
  });

  if (ptpDate) {
    const { data: existing } = await supabase
      .from('escalations')
      .select('id')
      .eq('case_id', caseId)
      .in('status', ['open', 'snoozed'])
      .order('level', { ascending: false })
      .limit(1)
      .maybeSingle();

    let escalationId = existing?.id;
    if (escalationId) {
      await supabase.from('escalations').update({
        status: 'snoozed',
        ptp_date: ptpDate,
        last_hq_update_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', escalationId);
    } else {
      const { data: created } = await supabase.from('escalations').insert({
        case_id: caseId,
        tranche_index: trancheIndex,
        level: 1,
        status: 'snoozed',
        ptp_date: ptpDate,
        trigger_reason: 'PTP recorded from collections',
        assigned_to: user.id,
      }).select('id').single();
      escalationId = created?.id;
    }

    if (escalationId) {
      await supabase.from('escalation_logs').insert({
        escalation_id: escalationId,
        logged_by: user.id,
        action_type: contactType === 'note' ? 'note' : contactType,
        outcome: `PTP set for ${ptpDate}${ptpAmount ? ` (₹${ptpAmount.toLocaleString('en-IN')})` : ''} by ${user.full_name ?? 'unknown'}`,
        next_followup_at: ptpDate,
      });
    }
  }

  revalidatePath('/collections');
}

// Daily triage board. Status lives in case_attributes.board = { status, date, by }
// and is only honoured for the current day — every morning the board resets.
export async function setBoardStatus(caseId: string, status: 'backlog' | 'today' | 'working' | 'done') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (!hasAnyRole(user, ['rm', 'kam', 'accounts', 'founder_admin'])) {
    throw new Error('No permission to update the collections board.');
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('credit_cases')
    .select('case_attributes')
    .eq('id', caseId)
    .single();
  if (!row) throw new Error('Case not found.');

  const attrs = { ...(row.case_attributes || {}) };
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (status === 'backlog') {
    delete attrs.board;
  } else {
    attrs.board = { status, date: todayIst, by: user.id };
  }

  await supabase.from('credit_cases').update({ case_attributes: attrs }).eq('id', caseId);
  revalidatePath('/collections');
}
