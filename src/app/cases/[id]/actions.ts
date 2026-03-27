"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent } from '@/utils/auth';
import { progressStage, setWaiting, withdrawCase } from '@/utils/engine';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function fetchCaseDetail(caseId: string) {
  const supabase = await createClient();

  const { data: caseData } = await supabase
    .from('credit_cases')
    .select(`
      *,
      customer:parties!credit_cases_customer_party_id_fkey(id, legal_name, customer_code),
      contractor:parties!credit_cases_contractor_party_id_fkey(id, legal_name, customer_code),
      rm:profiles!credit_cases_rm_user_id_fkey(id, full_name, email),
      kam:profiles!credit_cases_kam_user_id_fkey(id, full_name, email),
      branch:branches(name)
    `)
    .eq('id', caseId)
    .single();

  if (!caseData) return null;

  // Fetch history and exposure
  if (caseData.customer_party_id) {
    const [{ data: cExp }, { data: cHist }] = await Promise.all([
      supabase.from('party_exposure').select('*').eq('party_id', caseData.customer_party_id).order('data_as_of', { ascending: false }).limit(1).single(),
      supabase.from('party_history').select('*').eq('party_id', caseData.customer_party_id).order('data_as_of', { ascending: false }).limit(1).single()
    ]);
    caseData.customer_exposure = cExp;
    caseData.customer_history = cHist;
  }

  if (caseData.contractor_party_id) {
    const [{ data: cExp }, { data: cHist }] = await Promise.all([
      supabase.from('party_exposure').select('*').eq('party_id', caseData.contractor_party_id).order('data_as_of', { ascending: false }).limit(1).single(),
      supabase.from('party_history').select('*').eq('party_id', caseData.contractor_party_id).order('data_as_of', { ascending: false }).limit(1).single()
    ]);
    caseData.contractor_exposure = cExp;
    caseData.contractor_history = cHist;
  }

  // Fetch outcomes if closed
  if (caseData.status === 'Closed') {
    const { data: outcome } = await supabase.from('realized_outcomes').select('*').eq('case_id', caseId).single();
    caseData.outcome = outcome;
  }

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('*')
    .eq('case_id', caseId)
    .eq('is_active', true)
    .single();

  let tasks: any[] = [];
  if (cycle) {
    const { data: taskData } = await supabase
      .from('stage_tasks')
      .select('*, assigned:profiles!stage_tasks_assigned_to_fkey(full_name), param:parameter_definitions!stage_tasks_parameter_id_fkey(default_owning_role)')
      .eq('review_cycle_id', cycle.id)
      .order('stage').order('created_at');
    tasks = taskData || [];
  }

  const { data: auditEvents } = await supabase
    .from('audit_events')
    .select('*, actor:profiles!audit_events_actor_id_fkey(full_name)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(50);

  let approvalRounds: any[] = [];
  if (cycle) {
    const { data: rounds } = await supabase
      .from('approval_rounds')
      .select('*, decisions:approval_decisions(*, approver:profiles!approval_decisions_approver_id_fkey(full_name))')
      .eq('review_cycle_id', cycle.id)
      .order('created_at', { ascending: false });
    approvalRounds = rounds || [];
  }

  const { data: comments } = await supabase
    .from('case_comments')
    .select('*, author:profiles!case_comments_author_id_fkey(full_name)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  return { case: caseData, cycle, tasks, auditEvents: auditEvents || [], approvalRounds, comments: comments || [] };
}

export async function handleProgressStage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const cycleId = formData.get('cycleId') as string;
  const currentStage = parseInt(formData.get('currentStage') as string);
  const caseId = formData.get('caseId') as string;
  await progressStage(cycleId, currentStage, user.id);
  revalidatePath(`/cases/${caseId}`);
}

export async function handleWithdraw(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const caseId = formData.get('caseId') as string;
  const reason = formData.get('reason') as string;
  const note = formData.get('note') as string;
  await withdrawCase({ caseId, reason, note, actorId: user.id });
  redirect('/cases');
}

export async function handleCompleteTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const taskId = formData.get('taskId') as string;
  const caseId = formData.get('caseId') as string;
  const gradeValue = formData.get('gradeValue') ? parseInt(formData.get('gradeValue') as string) : null;
  const reason = formData.get('reason') as string || null;
  const rawInput = formData.get('rawInput') as string || null;

  await supabase.from('stage_tasks').update({
    status: 'Completed',
    completed_by: user.id,
    completed_at: new Date().toISOString(),
    grade_value: gradeValue,
    reason,
    raw_input_value: rawInput,
  }).eq('id', taskId);

  await logAuditEvent({ case_id: caseId, event_type: 'task_completed', actor_id: user.id, description: `Task completed.${gradeValue != null ? ` Grade: ${gradeValue}.` : ''}` });
  revalidatePath(`/cases/${caseId}`);
}

export async function handleForceReadyStage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;
  const cycleId = formData.get('cycleId') as string;
  const currentStage = parseInt(formData.get('currentStage') as string);
  const reason = formData.get('reason') as string;

  // Find missing required items
  const { data: missingTasks } = await supabase
    .from('stage_tasks')
    .select('description')
    .eq('review_cycle_id', cycleId)
    .eq('stage', currentStage)
    .eq('is_required', true)
    .neq('status', 'Completed')
    .neq('is_waived', true);

  const missingItems = missingTasks ? missingTasks.map((t: any) => t.description) : [];

  await supabase.from('stage_readiness').insert({
    review_cycle_id: cycleId,
    stage: currentStage,
    is_ready: true,
    is_force_readied: true,
    force_ready_reason: reason,
    missing_items: missingItems,
    readied_by: user.id,
    readied_at: new Date().toISOString()
  });

  // Makes case ambiguity-prone per docs
  await supabase.from('review_cycles').update({ is_ambiguous: true }).eq('id', cycleId);

  await logAuditEvent({
    case_id: caseId,
    review_cycle_id: cycleId,
    event_type: 'stage_force_ready',
    actor_id: user.id,
    description: `Stage ${currentStage} force-readied by KAM. Reason: ${reason}. Missing: ${missingItems.length} items. Case marked ambiguous.`,
    metadata: { missing_items: missingItems }
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function handleToggleWaiting(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;
  const isWaiting = formData.get('isWaiting') === 'true';
  const reason = formData.get('reason') as string;

  if (isWaiting) {
    // Stop waiting
    await supabase.from('credit_cases').update({
      status: 'In Review',
      substatus: null
    }).eq('id', caseId);

    await logAuditEvent({ case_id: caseId, event_type: 'waiting_ended', actor_id: user.id, description: 'Case waiting period ended. SLA clock resumed.' });
  } else {
    // Start waiting
    await setWaiting({ type: 'case', id: caseId, reason, actorId: user.id, caseId });
  }
  revalidatePath(`/cases/${caseId}`);
}

export async function handleChangePersona(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;
  const cycleId = formData.get('cycleId') as string;

  const customerPersonaId = formData.get('customerPersonaId') as string || null;
  const contractorPersonaId = formData.get('contractorPersonaId') as string || null;
  const domCategoryId = formData.get('dominanceCategoryId') as string || null;

  await supabase.from('review_cycles').update({
    customer_persona_id: customerPersonaId,
    contractor_persona_id: contractorPersonaId,
    dominance_category_id: domCategoryId
  }).eq('id', cycleId);

  await logAuditEvent({
    case_id: caseId,
    review_cycle_id: cycleId,
    event_type: 'persona_changed',
    actor_id: user.id,
    description: `Personas/Dominance updated for active cycle.`
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function handleCreateApprovalRound(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;
  const cycleId = formData.get('cycleId') as string;
  const stage = parseInt(formData.get('stage') as string);
  const roundType = formData.get('roundType') as string || 'ordinary';

  await supabase.from('approval_rounds').insert({ review_cycle_id: cycleId, stage, round_type: roundType, status: 'open' });
  await supabase.from('credit_cases').update({ status: roundType === 'appeal' ? 'Appealed' : 'Awaiting Approval' }).eq('id', caseId);
  await logAuditEvent({ case_id: caseId, review_cycle_id: cycleId, event_type: roundType === 'appeal' ? 'appeal_started' : 'approval_round_started', actor_id: user.id, description: `${roundType === 'appeal' ? 'Appeal' : 'Approval'} round started for Stage ${stage}.` });
  revalidatePath(`/cases/${caseId}`);
}

export async function handleApprovalDecision(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;
  const roundId = formData.get('roundId') as string;
  const decision = formData.get('decision') as string;
  const comment = formData.get('comment') as string || '';

  await supabase.from('approval_decisions').insert({ approval_round_id: roundId, approver_id: user.id, decision, comment });

  if (decision === 'reject') {
    await supabase.from('approval_rounds').update({ status: 'rejected', resolved_at: new Date().toISOString() }).eq('id', roundId);
    await supabase.from('credit_cases').update({ status: 'Rejected' }).eq('id', caseId);
  } else if (decision === 'return_for_revision') {
    await supabase.from('approval_rounds').update({ status: 'returned_for_revision', resolved_at: new Date().toISOString() }).eq('id', roundId);
    await supabase.from('credit_cases').update({ status: 'In Review', substatus: 'Returned for revision' }).eq('id', caseId);
  } else {
    const { data: allDecisions } = await supabase.from('approval_decisions').select('decision').eq('approval_round_id', roundId);
    const allApproved = allDecisions?.every((d: any) => d.decision === 'approve');
    if (allApproved) {
      await supabase.from('approval_rounds').update({ status: 'approved', resolved_at: new Date().toISOString() }).eq('id', roundId);
      await supabase.from('credit_cases').update({ status: 'Approved' }).eq('id', caseId);
    }
  }

  await logAuditEvent({ case_id: caseId, event_type: 'approval_decision', actor_id: user.id, description: `Approval: ${decision}.${comment ? ' ' + comment : ''}` });
  revalidatePath(`/cases/${caseId}`);
}

export async function handleSaveOutcome(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;
  const dealHappened = formData.get('dealHappened') === 'true';
  const paymentOnTime = formData.get('paymentOnTime') === 'true';
  const delayDays = parseInt(formData.get('realizedDelayDays') as string) || 0;
  const realizedExposure = parseFloat(formData.get('realizedExposure') as string) || 0;
  const notes = formData.get('notes') as string || '';

  await supabase.from('realized_outcomes').upsert({
    case_id: caseId,
    deal_happened: dealHappened,
    payment_on_time: paymentOnTime,
    realized_delay_days: delayDays,
    realized_exposure: realizedExposure,
    notes,
    recorded_by: user.id
  }, { onConflict: 'case_id' });

  await logAuditEvent({
    case_id: caseId,
    event_type: 'outcome_recorded',
    actor_id: user.id,
    description: `Realized outcome recorded.`
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function handleAddComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;
  const content = formData.get('content') as string;

  if (!content?.trim()) return;

  await supabase.from('case_comments').insert({ case_id: caseId, author_id: user.id, content: content.trim() });
  await logAuditEvent({ case_id: caseId, event_type: 'comment_added', actor_id: user.id, description: 'Comment added.' });
  revalidatePath(`/cases/${caseId}`);
}

export async function handleSelectiveUnlock(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const caseId = formData.get('caseId') as string;
  const section = formData.get('section') as string;
  const reason = formData.get('reason') as string;

  await logAuditEvent({
    case_id: caseId,
    event_type: 'selective_unlock',
    actor_id: user.id,
    description: `Unlocked ${section} for editing. Reason: ${reason}`
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function handleCounterOffer(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;
  const cycleId = formData.get('cycleId') as string;
  const compositeDays = parseFloat(formData.get('compositeDays') as string);
  const outcome = formData.get('outcome') as string;

  if (outcome === 'accepted') {
    await supabase.from('credit_cases').update({
      final_composite_credit_days: compositeDays,
      final_review_cycle_id: cycleId,
      status: 'Accepted'
    }).eq('id', caseId);

    await logAuditEvent({
      case_id: caseId,
      event_type: 'counter_offer_accepted',
      actor_id: user.id,
      description: `Counter-offer accepted. Composite days: ${compositeDays}.`
    });
  } else if (outcome === 'dropped') {
    await supabase.from('credit_cases').update({
      status: 'Closed',
      closure_reason: 'Customer Declined'
    }).eq('id', caseId);

    await logAuditEvent({
      case_id: caseId,
      event_type: 'counter_offer_dropped',
      actor_id: user.id,
      description: `Counter-offer declined by customer.`
    });
  }

  revalidatePath(`/cases/${caseId}`);
}
