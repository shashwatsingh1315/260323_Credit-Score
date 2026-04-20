"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent, hasAnyRole, isAdmin as checkIsAdmin } from '@/utils/auth';
import { progressStage, setWaiting, withdrawCase, sendNotification } from '@/utils/engine';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { updateCycleScore } from '@/utils/scoring';
import { fetchLedgerData } from './billing-actions';

export async function fetchCaseCore(caseId: string) {
  const supabase = await createClient({ next: { tags: [`case-${caseId}`] } });

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

  const { checkAndApplyAutoEscalation } = await import('@/utils/engine');
  await checkAndApplyAutoEscalation(caseId);

  // I3: Enforce validity rules if case is Approved
  if (caseData.status === 'Approved' && caseData.updated_at) {
    const { data: validityRules } = await supabase.from('validity_rules').select('*').limit(1);
    const validityDays = validityRules?.[0]?.validity_days || 90; // Default to 90
    const approvedAt = new Date(caseData.updated_at).getTime();
    const now = new Date().getTime();
    const daysSinceApproval = (now - approvedAt) / (1000 * 3600 * 24);

    if (daysSinceApproval > validityDays) {
      await supabase.from('credit_cases').update({ status: 'Expired', substatus: 'Approval Validity Expired' }).eq('id', caseId);
      caseData.status = 'Expired';
      caseData.substatus = 'Approval Validity Expired';

      await logAuditEvent({
        case_id: caseId,
        event_type: 'case_expired',
        description: `Case approval expired after ${validityDays} days.`
      });
    }
  }

  const [
    customerData,
    contractorData,
    outcomeData,
    cycleData,
  ] = await Promise.all([
    caseData.customer_party_id ? Promise.all([
      supabase.from('party_exposure').select('*').eq('party_id', caseData.customer_party_id).order('data_as_of', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('party_history').select('*').eq('party_id', caseData.customer_party_id).order('data_as_of', { ascending: false }).limit(1).maybeSingle()
    ]) : Promise.resolve([null, null]),
    caseData.contractor_party_id ? Promise.all([
      supabase.from('party_exposure').select('*').eq('party_id', caseData.contractor_party_id).order('data_as_of', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('party_history').select('*').eq('party_id', caseData.contractor_party_id).order('data_as_of', { ascending: false }).limit(1).maybeSingle()
    ]) : Promise.resolve([null, null]),
    caseData.status === 'Closed' ? supabase.from('realized_outcomes').select('*').eq('case_id', caseId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('review_cycles').select('*').eq('case_id', caseId).eq('is_active', true).maybeSingle(),
  ]);

  if (customerData[0] && customerData[0].data) caseData.customer_exposure = customerData[0].data;
  if (customerData[1] && customerData[1].data) caseData.customer_history = customerData[1].data;
  if (contractorData[0] && contractorData[0].data) caseData.contractor_exposure = contractorData[0].data;
  if (contractorData[1] && contractorData[1].data) caseData.contractor_history = contractorData[1].data;
  caseData.outcome = outcomeData.data;

  const cycle = cycleData.data;

  return { case: caseData, cycle };
}

export async function fetchCaseTasks(cycleId: string, caseScenario: string, policySnapshotId: string, activeStage: number, caseId: string) {
  if (!cycleId) return { tasks: [], stageSummaries: [], rcaReasons: [], delayReasons: [], users: [] };
  const supabase = await createClient({ next: { tags: [`case-${caseId}-tasks`] } });

  const [
    tasksRes,
    rcaReasonsData,
    delayReasonsData,
    usersData,
    roundsRes
  ] = await Promise.all([
    supabase.from('stage_tasks').select('*, assigned:profiles!stage_tasks_assigned_to_fkey(full_name), param:parameter_definitions!stage_tasks_parameter_id_fkey(default_owning_role, input_type, auto_band_config, name, require_reasoning, sla_days, weight)').eq('review_cycle_id', cycleId).order('stage').order('created_at'),
    supabase.from('admin_enumerations').select('value').eq('category', 'reason_for_credit').eq('is_active', true).order('sort_order'),
    supabase.from('admin_enumerations').select('value').eq('category', 'delay_reason').eq('is_active', true).order('sort_order'),
    supabase.from('profiles').select('id, full_name, roles:user_roles(role)').order('full_name'),
    supabase.from('approval_rounds').select('id, stage, status').eq('review_cycle_id', cycleId) // minimal fetch for summaries
  ]);

  const tasks = tasksRes.data || [];
  const rcaReasons = rcaReasonsData.data || [];
  const delayReasons = delayReasonsData.data || [];
  const users = usersData.data || [];
  const approvalRounds = roundsRes.data || [];

  const { data: cycleRow } = await supabase.from('review_cycles').select('current_case_score, score_band_name, approved_credit_days').eq('id', cycleId).single();

  const summariesRes = await Promise.all([1, 2, 3].map(async (s) => {
    const isCurrent = activeStage === s;
    const isPast = activeStage > s;
    
    let score = null;
    let bandName = 'No Band';
    let approvedDays = 0;

    if (isCurrent && cycleRow) {
      score = cycleRow.current_case_score;
      bandName = cycleRow.score_band_name || 'No Band';
      approvedDays = cycleRow.approved_credit_days || 0;
    } else if (isPast) {
       const scoring = await import('@/utils/scoring');
       const scoreResult = await scoring.calculateFinalCaseScore({ reviewCycleId: cycleId, caseScenario, upToStage: s });
       const bandResult = await scoring.mapScoreToCreditDays({ policyVersionId: policySnapshotId, score: scoreResult.finalScore });
       score = scoreResult.finalScore;
       bandName = bandResult?.bandName || 'No Band';
       approvedDays = bandResult?.approvedDays || 0;
    }

    return { stage: s, score, bandName, approvedDays, isCurrent };
  }));

  const stageSummaries = summariesRes.map(s => {
    const stageRounds = approvalRounds.filter((r: any) => r.stage === s.stage);
    let status = 'Pending';
    if (stageRounds.some((r: any) => r.status === 'approved')) status = 'Approved';
    else if (stageRounds.some((r: any) => r.status === 'rejected')) status = 'Rejected';
    else if (stageRounds.some((r: any) => r.status === 'open')) status = 'Awaiting Approval';
    else if (activeStage === s.stage) status = 'In Progress';
    else if (activeStage > s.stage) status = 'Completed';
    return { ...s, status };
  });

  return { tasks, stageSummaries, rcaReasons, delayReasons, users };
}

export async function fetchCaseApprovals(cycleId: string, caseId: string) {
  if (!cycleId) return { approvalRounds: [], boardRounds: [] };
  const supabase = await createClient({ next: { tags: [`case-${caseId}-approvals`] } });

  const { data: approvalRounds } = await supabase.from('approval_rounds').select('*, decisions:approval_decisions(*, approver:profiles!approval_decisions_approver_id_fkey(full_name))').eq('review_cycle_id', cycleId).order('created_at', { ascending: false });

  let boardRounds: any[] = [];
  if (approvalRounds && approvalRounds.length > 0) {
    const roundIds = approvalRounds.map((r: any) => r.id);
    const { data: br } = await supabase.from('board_rounds').select('*, votes:board_votes(*, voter:profiles!board_votes_voter_id_fkey(full_name, id))').in('approval_round_id', roundIds).order('created_at', { ascending: false });
    boardRounds = br || [];
  }

  return { approvalRounds: approvalRounds || [], boardRounds };
}

export async function fetchCaseAudit(caseId: string) {
  const supabase = await createClient({ next: { tags: [`case-${caseId}-audit`] } });
  const { data: auditEvents } = await supabase.from('audit_events').select('*, actor:profiles!audit_events_actor_id_fkey(full_name)').eq('case_id', caseId).order('created_at', { ascending: false }).limit(50);
  return { auditEvents: auditEvents || [] };
}

export async function fetchCaseComments(caseId: string) {
  const supabase = await createClient({ next: { tags: [`case-${caseId}-comments`] } });
  const [
    { data: comments },
    { data: users }
  ] = await Promise.all([
    supabase.from('case_comments').select('*, author:profiles!case_comments_author_id_fkey(full_name)').eq('case_id', caseId).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, roles:user_roles(role)').order('full_name')
  ]);
  return { comments: comments || [], users: users || [] };
}

export async function fetchCaseLedger(caseId: string, caseStatus: string) {
  if (['Approved', 'Accepted', 'Billing Active', 'Pending Write-Off Approval', 'Closed', 'Cancelled'].includes(caseStatus)) {
    const ledger = await fetchLedgerData(caseId);
    return { ledger };
  }
  return { ledger: null };
}

export async function handleProgressStage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can progress stages');
  }

  const cycleId = formData.get('cycleId') as string;
  const currentStage = parseInt(formData.get('currentStage') as string);
  const caseId = formData.get('caseId') as string;

  await progressStage(cycleId, currentStage, user.id);
  revalidatePath(`/cases/${caseId}`);
}

export async function handleAssignTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const taskId = formData.get('taskId') as string;
  const caseId = formData.get('caseId') as string;

  const assigneeId = formData.get('assigneeId') as string;

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can assign tasks');
  }

  const supabase = await createClient();

  await supabase.from('stage_tasks').update({
    assigned_to: assigneeId || null
  }).eq('id', taskId);

  let assigneeName = 'Unassigned';
  if (assigneeId) {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', assigneeId).single();
    if (profile) assigneeName = profile.full_name;
  }

  await logAuditEvent({
    case_id: caseId,
    event_type: 'task_assigned',
    actor_id: user.id,
    description: `Task assigned to ${assigneeName}.`
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function handleWithdraw(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['rm', 'kam', 'founder_admin'])) {
    throw new Error('Unauthorized to withdraw case');
  }

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


  // RBAC Audit for task completion
  const { data: task } = await supabase
    .from('stage_tasks')
    .select('*, param:parameter_definitions!stage_tasks_parameter_id_fkey(default_owning_role, input_type, auto_band_config)')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');

  const isAdmin = checkIsAdmin(user);
  const hasCorrectRole = !task.param?.default_owning_role || user.roles.includes(task.param.default_owning_role);

  if (!isAdmin && !hasCorrectRole) {
    throw new Error(`Unauthorized. This task requires the ${task.param?.default_owning_role?.toUpperCase()} role.`);
  }

  const rawGrade = formData.get('gradeValue') as string | null;
  let gradeValue = (rawGrade && rawGrade.trim() !== '') ? parseInt(rawGrade) : null;
  if (gradeValue !== null && isNaN(gradeValue)) gradeValue = null;
  const reason = formData.get('reason') as string || null;
  const rawInput = formData.get('rawInput') as string || null;
  const delayReason = formData.get('delayReason') as string || null;

  const now = new Date();
  const isOverdue = task.sla_deadline && new Date(task.sla_deadline) < now;
  if (isOverdue && !delayReason) {
    throw new Error('A delay reason is required because this task is past its SLA deadline.');
  }

  if (gradeValue === null && rawInput !== null && task.param) {
    const p = task.param;
    if (p.input_type === 'numeric' && p.auto_band_config?.bands) {
      const numVal = parseFloat(rawInput);
      if (!isNaN(numVal)) {
        const band = p.auto_band_config.bands.find((b: any) => numVal >= b.min && numVal <= b.max);
        if (band) gradeValue = band.grade;
      }
    } else if ((p.input_type === 'dropdown' || p.input_type === 'link_list' || p.input_type === 'yes_no') && p.auto_band_config?.mappings) {
      const mapping = p.auto_band_config.mappings.find((m: any) => m.value.toLowerCase() === String(rawInput).toLowerCase());
      if (mapping) gradeValue = mapping.grade;
    }
  }

  const ops = [
    supabase.from('stage_tasks').update({
      status: 'Completed',
      completed_by: user.id,
      completed_at: now.toISOString(),
      grade_value: gradeValue,
      reason,
      raw_input_value: rawInput,
      delay_reason: delayReason,
    }).eq('id', taskId),
    logAuditEvent({ case_id: caseId, event_type: 'task_completed', actor_id: user.id, description: `Task completed.${gradeValue != null ? ` Grade: ${gradeValue}.` : ''}${delayReason ? ` Delay reason: ${delayReason}.` : ''}` })
  ];

  if (gradeValue != null && task?.review_cycle_id) {
    ops.push(updateCycleScore(task.review_cycle_id));
  }

  await Promise.all(ops);

  revalidatePath(`/cases/${caseId}`);
}

export async function handleForceReadyStage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can force ready a stage');
  }

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

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can toggle waiting state');
  }

  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;

  const isWaiting = formData.get('isWaiting') === 'true';
  const reason = formData.get('reason') as string;

  if (!isWaiting) {
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

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can change personas');
  }

  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;

  const cycleId = formData.get('cycleId') as string;

  const customerPersonaId = formData.get('customerPersonaId') as string || null;
  const contractorPersonaId = formData.get('contractorPersonaId') as string || null;
  const domCategoryId = formData.get('dominanceCategoryId') as string || null;

  // Validate persona-policy linkage
  const [
    { data: cycle },
    customerPersonaRes,
    contractorPersonaRes
  ] = await Promise.all([
    supabase.from('review_cycles').select('policy_snapshot_id').eq('id', cycleId).single(),
    customerPersonaId ? supabase.from('personas').select('policy_version_id').eq('id', customerPersonaId).single() : Promise.resolve({ data: null }),
    contractorPersonaId ? supabase.from('personas').select('policy_version_id').eq('id', contractorPersonaId).single() : Promise.resolve({ data: null })
  ]);

  if (customerPersonaRes.data && customerPersonaRes.data.policy_version_id !== cycle?.policy_snapshot_id) {
    throw new Error("Customer Persona does not belong to the current policy snapshot.");
  }
  if (contractorPersonaRes.data && contractorPersonaRes.data.policy_version_id !== cycle?.policy_snapshot_id) {
    throw new Error("Contractor Persona does not belong to the current policy snapshot.");
  }

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

  await updateCycleScore(cycleId);
  revalidatePath(`/cases/${caseId}`);
}

export async function handleCreateApprovalRound(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const roundType = formData.get('roundType') as string || 'ordinary';

  if (roundType === 'ordinary' && !hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can request ordinary approval');
  }
  if (roundType === 'appeal' && !hasAnyRole(user, ['rm', 'kam', 'founder_admin'])) {
    throw new Error('Only RM, KAM or Admin can initiate appeal');
  }

  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;

  const cycleId = formData.get('cycleId') as string;
  const stage = parseInt(formData.get('stage') as string);

  await supabase.from('approval_rounds').insert({ review_cycle_id: cycleId, stage, round_type: roundType, status: 'open' });
  await supabase.from('credit_cases').update({ status: roundType === 'appeal' ? 'Appealed' : 'Awaiting Approval' }).eq('id', caseId);
  await logAuditEvent({ case_id: caseId, review_cycle_id: cycleId, event_type: roundType === 'appeal' ? 'appeal_started' : 'approval_round_started', actor_id: user.id, description: `${roundType === 'appeal' ? 'Appeal' : 'Approval'} round started for Stage ${stage}.` });
  revalidatePath(`/cases/${caseId}`);
}

export async function handleApprovalDecision(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['ordinary_approver', 'board_member', 'founder_admin'])) {
    throw new Error('Unauthorized to make approval decisions');
  }

  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;

  const roundId = formData.get('roundId') as string;
  const decision = formData.get('decision') as string;
  const comment = formData.get('comment') as string || '';

  // Further check: board member role required for board/appeal rounds if we want to be strict
  // For now, union of roles is allowed per doc


  // Check if approver is the rm_user_id or kam_user_id to prevent approving own case
  const { data: currentCaseApprover } = await supabase.from('credit_cases').select('rm_user_id, kam_user_id').eq('id', caseId).single();
  if (currentCaseApprover && (currentCaseApprover.rm_user_id === user.id || currentCaseApprover.kam_user_id === user.id)) {
    throw new Error('Conflict of interest: Cannot approve a case where you are the RM or KAM.');
  }

  await supabase.from('approval_decisions').insert({ approval_round_id: roundId, approver_id: user.id, decision, comment });


  let isFullyApproved = false;
  if (decision === 'reject') {
    await Promise.all([
      supabase.from('approval_rounds').update({ status: 'rejected', resolved_at: new Date().toISOString() }).eq('id', roundId),
      supabase.from('credit_cases').update({ status: 'Rejected' }).eq('id', caseId)
    ]);
  } else if (decision === 'return_for_revision') {
    await Promise.all([
      supabase.from('approval_rounds').update({ status: 'returned_for_revision', resolved_at: new Date().toISOString() }).eq('id', roundId),
      supabase.from('credit_cases').update({ status: 'In Review', substatus: 'Returned for revision' }).eq('id', caseId)
    ]);
  } else {
    const { data: allDecisions } = await supabase.from('approval_decisions').select('decision').eq('approval_round_id', roundId);
    isFullyApproved = allDecisions?.every((d: any) => d.decision === 'approve') || false;
    if (isFullyApproved) {
      await Promise.all([
        supabase.from('approval_rounds').update({ status: 'approved', resolved_at: new Date().toISOString() }).eq('id', roundId),
        supabase.from('credit_cases').update({ status: 'Approved' }).eq('id', caseId)
      ]);
    }
  }

  const [_, { data: creditCase }] = await Promise.all([
    logAuditEvent({ case_id: caseId, event_type: 'approval_decision', actor_id: user.id, description: `Approval: ${decision}.${comment ? ' ' + comment : ''}` }),
    supabase.from('credit_cases').select('case_number, rm_user_id').eq('id', caseId).single()
  ]);
  if (creditCase?.rm_user_id) {
    if (decision === 'reject') {
      await sendNotification(creditCase.rm_user_id, 'Case Rejected', `Case ${creditCase.case_number} has been rejected.`);
    } else if (decision === 'return_for_revision') {
      await sendNotification(creditCase.rm_user_id, 'Case Returned', `Case ${creditCase.case_number} was returned for revision.`);
    } else if (isFullyApproved) {
      await sendNotification(creditCase.rm_user_id, 'Case Approved', `Case ${creditCase.case_number} has been fully approved.`);
    }
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function handleSaveOutcome(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can record realized outcomes');
  }

  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;

  const dealHappened = formData.get('dealHappened') === 'true';
  const paymentOnTime = formData.get('paymentOnTime') === 'true';
  const delayDays = parseInt(formData.get('realizedDelayDays') as string) || 0;
  const realizedExposure = parseFloat(formData.get('realizedExposure') as string) || 0;
  const notes = formData.get('notes') as string || '';

  const { data: existingOutcome } = await supabase.from('realized_outcomes').select('id').eq('case_id', caseId).single();

  const outcomePayload = {
    case_id: caseId,
    deal_happened: dealHappened,
    payment_on_time: paymentOnTime,
    realized_delay_days: delayDays,
    realized_exposure: realizedExposure,
    notes,
    recorded_by: user.id
  };

  if (existingOutcome) {
    await supabase.from('realized_outcomes').update(outcomePayload).eq('id', existingOutcome.id);
  } else {
    await supabase.from('realized_outcomes').insert(outcomePayload);
  }

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
  const mentionedUserIdsRaw = formData.get('mentionedUserIds') as string;
  const mentionedUserIds: string[] = mentionedUserIdsRaw
    ? JSON.parse(mentionedUserIdsRaw)
    : [];

  if (!content?.trim()) return;

  const { data: comment } = await supabase.from('case_comments').insert({
    case_id: caseId,
    author_id: user.id,
    body: content.trim(),
    mentioned_user_ids: mentionedUserIds,
  }).select('id').single();

  // Notify mentioned users
  if (mentionedUserIds.length > 0) {
    const { data: caseRow } = await supabase
      .from('credit_cases')
      .select('case_number')
      .eq('id', caseId)
      .single();

    const notifRows = mentionedUserIds.map(uid => ({
      user_id: uid,
      title: `You were mentioned in ${caseRow?.case_number}`,
      message: `${user.full_name} tagged you: "${content.trim().slice(0, 80)}…"`,
      link_url: `/cases/${caseId}`,
    }));
    await supabase.from('notifications').insert(notifRows);
  }

  await logAuditEvent({
    case_id: caseId,
    event_type: 'comment_added',
    actor_id: user.id,
    description: `Comment added.${mentionedUserIds.length > 0 ? ` Tagged ${mentionedUserIds.length} user(s).` : ''}`,
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function handleSelectiveUnlock(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['ordinary_approver', 'board_member', 'founder_admin'])) {
    throw new Error('Only authorized approvers or Admin can unlock sections');
  }

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

  const { data: currentCase } = await supabase.from('credit_cases').select('rm_user_id').eq('id', caseId).single();
  if (currentCase?.rm_user_id === user.id) {
    throw new Error('Conflict of interest: The initiating RM cannot accept their own counter-offer. It requires KAM approval.');
  }

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

export async function handleBoardVote(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['board_member', 'founder_admin'])) {
    throw new Error('Only Board Members or Admin can cast board votes.');
  }

  const supabase = await createClient();
  const boardRoundId = formData.get('boardRoundId') as string;
  const caseId = formData.get('caseId') as string;

  const decision = formData.get('decision') as string;
  const comment = formData.get('comment') as string || '';

  // Upsert: board members can update their vote within the window
  const { error } = await supabase.from('board_votes').upsert({
    board_round_id: boardRoundId,
    voter_id: user.id,
    decision,
    comment,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'board_round_id,voter_id' });

  if (error) throw new Error(error.message);

  await logAuditEvent({
    case_id: caseId,
    event_type: 'board_vote',
    actor_id: user.id,
    description: `Board vote: ${decision}.${comment ? ' ' + comment : ''}`,
  });

  revalidatePath(`/cases/${caseId}`);
}
