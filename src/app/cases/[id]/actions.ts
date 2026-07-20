"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent, hasAnyRole, isAdmin as checkIsAdmin } from '@/utils/auth';
import { progressStage, setWaiting, withdrawCase, sendNotification } from '@/utils/engine';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { updateCycleScore } from '@/utils/scoring';
import { assertCanCastBoardVote, BOARD_VOTE_DECISIONS } from '@/utils/boardGuards';
import { fetchLedgerData } from './billing-actions';
import { calculateValidityExpiry, selectValidityRule } from '@/utils/validity';

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

  const [
    customerData,
    contractorData,
    outcomeData,
    cycleData,
    founderOverrideData,
  ] = await Promise.all([
    caseData.customer_party_id ? Promise.all([
      supabase.from('party_exposure').select('*').eq('party_id', caseData.customer_party_id).order('data_as_of', { ascending: false }).limit(1).single(),
      supabase.from('party_history').select('*').eq('party_id', caseData.customer_party_id).order('data_as_of', { ascending: false }).limit(1).single()
    ]) : Promise.resolve([null, null]),
    caseData.contractor_party_id ? Promise.all([
      supabase.from('party_exposure').select('*').eq('party_id', caseData.contractor_party_id).order('data_as_of', { ascending: false }).limit(1).single(),
      supabase.from('party_history').select('*').eq('party_id', caseData.contractor_party_id).order('data_as_of', { ascending: false }).limit(1).single()
    ]) : Promise.resolve([null, null]),
    caseData.status === 'Closed' ? supabase.from('realized_outcomes').select('*').eq('case_id', caseId).single() : Promise.resolve({ data: null }),
    supabase.from('review_cycles').select('*').eq('case_id', caseId).eq('is_active', true).single(),
    supabase
      .from('audit_events')
      .select('id, created_at, description, metadata, field_diffs, actor:profiles!audit_events_actor_id_fkey(full_name)')
      .eq('case_id', caseId)
      .eq('event_type', 'founder_credit_days_override')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (customerData[0] && customerData[0].data) caseData.customer_exposure = customerData[0].data;
  if (customerData[1] && customerData[1].data) caseData.customer_history = customerData[1].data;
  if (contractorData[0] && contractorData[0].data) caseData.contractor_exposure = contractorData[0].data;
  if (contractorData[1] && contractorData[1].data) caseData.contractor_history = contractorData[1].data;
  caseData.outcome = outcomeData.data;

  const cycle = cycleData.data;

  // Personas / dominance categories for this cycle's policy version — the
  // change-persona UI must offer named choices, never raw UUID entry.
  let policyOptions: { personas: any[]; dominanceCategories: any[] } = { personas: [], dominanceCategories: [] };
  if (cycle?.policy_snapshot_id) {
    const [personasRes, domRes] = await Promise.all([
      supabase.from('personas').select('id, name').eq('policy_version_id', cycle.policy_snapshot_id).order('name'),
      supabase.from('dominance_categories').select('id, name, combination_method').eq('policy_version_id', cycle.policy_snapshot_id).order('name'),
    ]);
    policyOptions = { personas: personasRes.data || [], dominanceCategories: domRes.data || [] };
  }

  return { case: caseData, cycle, founderOverride: founderOverrideData.data, policyOptions, renderedAt: new Date().toISOString() };
}

export async function fetchCaseTasks(cycleId: string, caseScenario: string, policySnapshotId: string, activeStage: number, caseId: string) {
  if (!cycleId) return { tasks: [], stageSummaries: [], rcaReasons: [], delayReasons: [], users: [], gradeScale: [] };
  const supabase = await createClient({ next: { tags: [`case-${caseId}-tasks`] } });

  const [
    tasksRes,
    rcaReasonsData,
    delayReasonsData,
    usersData,
    roundsRes,
    gradeScaleRes
  ] = await Promise.all([
    supabase.from('stage_tasks').select('*, assigned:profiles!stage_tasks_assigned_to_fkey(full_name), param:parameter_definitions!stage_tasks_parameter_id_fkey(default_owning_role, input_type, auto_band_config, name, require_reasoning, sla_days, weight, rubric_guidance)').eq('review_cycle_id', cycleId).order('stage').order('created_at'),
    supabase.from('admin_enumerations').select('value').eq('category', 'reason_for_credit').eq('is_active', true).order('sort_order'),
    supabase.from('admin_enumerations').select('value').eq('category', 'delay_reason').eq('is_active', true).order('sort_order'),
    supabase.from('profiles').select('id, full_name, roles:user_roles(role)').order('full_name'),
    supabase.from('approval_rounds').select('id, stage, status').eq('review_cycle_id', cycleId), // minimal fetch for summaries
    // Grade labels for THIS cycle's policy version, not the currently-active policy
    supabase.from('grade_scale').select('grade_value, grade_label').eq('policy_version_id', policySnapshotId).order('grade_value', { ascending: false })
  ]);

  const tasks = tasksRes.data || [];
  const rcaReasons = rcaReasonsData.data || [];
  const delayReasons = delayReasonsData.data || [];
  const users = usersData.data || [];
  const approvalRounds = roundsRes.data || [];
  const gradeScale = gradeScaleRes.data || [];

  const summariesRes = await Promise.all([1, 2, 3].map(async (s) => {
    const isCurrent = activeStage === s;
    const isPast = activeStage > s;
    
    let score = null;
    let bandName = 'No Band';
    let approvedDays = 0;

    if (isCurrent) {
       // current calculation deferred to UI or client side
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

  return { tasks, stageSummaries, rcaReasons, delayReasons, users, gradeScale };
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

/**
 * One authoritative next action (doctrine Principle 3): the system decides the
 * valid transition. Stages 1–2 progress forward; Stage 3 opens an approval
 * round. Users should never have to choose between "Progress" and
 * "Request Approval" based on internal workflow knowledge.
 */
export async function handleSubmitStage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can submit stages');
  }

  const cycleId = formData.get('cycleId') as string;
  const currentStage = parseInt(formData.get('currentStage') as string);
  const caseId = formData.get('caseId') as string;
  const supabase = await createClient();
  const { data: cycle } = await supabase.from('review_cycles').select('required_stage').eq('id', cycleId).maybeSingle();
  const requiredStage = cycle?.required_stage ?? 3;

  if (currentStage < requiredStage) {
    await progressStage(cycleId, currentStage, user.id);
    await logAuditEvent({ case_id: caseId, review_cycle_id: cycleId, event_type: 'stage_submitted', actor_id: user.id, description: `Stage ${currentStage} submitted. Case progressed to Stage ${currentStage + 1}.` });
  } else {
    await supabase.from('approval_rounds').insert({ review_cycle_id: cycleId, stage: currentStage, round_type: 'ordinary', status: 'open' });
    await supabase.from('credit_cases').update({ status: 'Awaiting Approval' }).eq('id', caseId);
    await logAuditEvent({ case_id: caseId, review_cycle_id: cycleId, event_type: 'approval_round_started', actor_id: user.id, description: `Stage ${currentStage} submitted for approval. Ordinary approval round opened.` });
  }
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
  const reasonChoice = formData.get('reason') as string || '';
  const reasonNote = formData.get('reasonNote') as string || '';
  const reason = [reasonChoice, reasonNote.trim()].filter(Boolean).join(' — ') || null;
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
    supabase.from('review_cycles').select('policy_snapshot_id, current_case_score, score_band_name').eq('id', cycleId).single(),
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

  await updateCycleScore(cycleId);
  const { data: rescoredCycle } = await supabase.from('review_cycles').select('current_case_score, score_band_name').eq('id', cycleId).maybeSingle();

  await logAuditEvent({
    case_id: caseId,
    review_cycle_id: cycleId,
    event_type: 'persona_changed',
    actor_id: user.id,
    description: `Personas changed — score ${cycle?.current_case_score ?? '—'} → ${rescoredCycle?.current_case_score ?? '—'} (band ${cycle?.score_band_name ?? '—'} → ${rescoredCycle?.score_band_name ?? '—'}).`
  });

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
  const overrideDaysRaw = (formData.get('overrideCreditDays') as string || '').trim();
  const overrideReason = (formData.get('overrideReason') as string || '').trim();
  const wantsFounderOverride = overrideDaysRaw.length > 0;

  let founderOverride: {
    cycleId: string;
    policyRecommendedDays: number;
    previousApprovedDays: number;
    overrideDays: number;
    reason: string;
  } | null = null;

  if (wantsFounderOverride) {
    if (decision !== 'approve' || !checkIsAdmin(user)) {
      throw new Error('Only Founder Admin can approve credit days above the policy recommendation.');
    }

    const overrideDays = Number(overrideDaysRaw);
    if (!Number.isInteger(overrideDays) || overrideDays <= 0) {
      throw new Error('Override credit days must be a positive whole number.');
    }
    if (!overrideReason) {
      throw new Error('A reason is required for a Founder Admin credit-days override.');
    }

    const [{ data: overrideRound, error: roundError }, { data: priorOverride }] = await Promise.all([
      supabase.from('approval_rounds').select('review_cycle_id, status').eq('id', roundId).maybeSingle(),
      supabase
        .from('audit_events')
        .select('metadata')
        .eq('case_id', caseId)
        .eq('event_type', 'founder_credit_days_override')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (roundError || !overrideRound || overrideRound.status !== 'open') {
      throw new Error('The approval round is no longer open.');
    }

    const { data: overrideCycle, error: cycleError } = await supabase
      .from('review_cycles')
      .select('id, case_id, approved_credit_days')
      .eq('id', overrideRound.review_cycle_id)
      .maybeSingle();
    if (cycleError || !overrideCycle || overrideCycle.case_id !== caseId) {
      throw new Error('The approval round does not belong to this case.');
    }

    const policyRecommendedDays = Number(priorOverride?.metadata?.policy_recommended_credit_days ?? overrideCycle.approved_credit_days);
    if (!Number.isFinite(policyRecommendedDays)) {
      throw new Error('The policy recommendation must be calculated before it can be overridden.');
    }
    if (overrideDays <= policyRecommendedDays) {
      throw new Error(`Founder override must be higher than the policy recommendation of ${policyRecommendedDays} days.`);
    }

    founderOverride = {
      cycleId: overrideCycle.id,
      policyRecommendedDays,
      previousApprovedDays: Number(overrideCycle.approved_credit_days ?? policyRecommendedDays),
      overrideDays,
      reason: overrideReason,
    };
  }

  // Doctrine Principle 10: high-impact decisions require structured rationale.
  if ((decision === 'reject' || decision === 'return_for_revision') && !comment.trim()) {
    throw new Error('A reason is required when rejecting or returning a case for revision.');
  }

  // Further check: board member role required for board/appeal rounds if we want to be strict
  // For now, union of roles is allowed per doc

  const recordedComment = founderOverride
    ? [comment.trim(), `Founder override: ${founderOverride.overrideDays} credit days. Reason: ${founderOverride.reason}`].filter(Boolean).join('\n')
    : comment;

  await supabase.from('approval_decisions').insert({ approval_round_id: roundId, approver_id: user.id, decision, comment: recordedComment });

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
      const approvedAt = new Date();
      const { data: round } = await supabase.from('approval_rounds').select('review_cycle_id').eq('id', roundId).maybeSingle();
      const { data: approvalCycle } = round?.review_cycle_id
        ? await supabase.from('review_cycles').select('policy_snapshot_id, score_band_name').eq('id', round.review_cycle_id).maybeSingle()
        : { data: null };
      const { data: approvalCase } = await supabase.from('credit_cases').select('case_scenario').eq('id', caseId).maybeSingle();
      const { data: validityRules } = approvalCycle?.policy_snapshot_id
        ? await supabase.from('validity_rules').select('context_rule, validity_days').eq('policy_version_id', approvalCycle.policy_snapshot_id)
        : { data: [] };
      const validityRule = selectValidityRule(validityRules || [], {
        score_band: approvalCycle?.score_band_name,
        scenario: approvalCase?.case_scenario,
      });
      const validityExpiresAt = validityRule
        ? calculateValidityExpiry(approvedAt, validityRule.validity_days).toISOString()
        : null;

      const cycleUpdate = {
        decision: 'approved',
        finalized_at: approvedAt.toISOString(),
        validity_expires_at: validityExpiresAt,
        ...(founderOverride ? { approved_credit_days: founderOverride.overrideDays } : {}),
      };

      const [roundUpdate, caseUpdate, cycleUpdateResult] = await Promise.all([
        supabase.from('approval_rounds').update({ status: 'approved', resolved_at: approvedAt.toISOString() }).eq('id', roundId),
        supabase.from('credit_cases').update({ status: 'Approved' }).eq('id', caseId),
        round?.review_cycle_id
          ? supabase.from('review_cycles').update(cycleUpdate).eq('id', round.review_cycle_id)
          : Promise.resolve({ error: null }),
      ]);
      if (roundUpdate.error || caseUpdate.error || cycleUpdateResult.error) {
        throw roundUpdate.error || caseUpdate.error || cycleUpdateResult.error;
      }

      if (founderOverride) {
        await logAuditEvent({
          case_id: caseId,
          review_cycle_id: founderOverride.cycleId,
          event_type: 'founder_credit_days_override',
          actor_id: user.id,
          description: `Founder Admin approved ${founderOverride.overrideDays} credit days against the policy recommendation of ${founderOverride.policyRecommendedDays} days. Reason: ${founderOverride.reason}`,
          field_diffs: {
            approved_credit_days: {
              from: founderOverride.previousApprovedDays,
              to: founderOverride.overrideDays,
            },
          },
          metadata: {
            policy_recommended_credit_days: founderOverride.policyRecommendedDays,
            founder_override_credit_days: founderOverride.overrideDays,
            override_reason: founderOverride.reason,
          },
        });
      }
      if (validityRule && round?.review_cycle_id) {
        await logAuditEvent({
          case_id: caseId,
          review_cycle_id: round.review_cycle_id,
          event_type: 'approval_validity_stamped',
          actor_id: user.id,
          description: `Approval valid for ${validityRule.validity_days} days, until ${validityExpiresAt}. Warnings do not block negotiation or acceptance.`,
        });
      }
    }
  }

  const [_, { data: creditCase }] = await Promise.all([
    logAuditEvent({ case_id: caseId, event_type: 'approval_decision', actor_id: user.id, description: `Approval: ${decision}.${recordedComment ? ' ' + recordedComment : ''}` }),
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

  // Recording the customer's answer to approved terms is the KAM's call.
  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can record a negotiation outcome.');
  }

  const supabase = await createClient();
  const caseId = formData.get('caseId') as string;
  const cycleId = formData.get('cycleId') as string;
  const compositeDays = parseFloat(formData.get('compositeDays') as string);
  const outcome = formData.get('outcome') as string;

  // Negotiation outcomes only make sense for a case sitting at Approved.
  const [{ data: currentCase }, { data: currentCycle }] = await Promise.all([
    supabase.from('credit_cases').select('status, proposed_tranches').eq('id', caseId).maybeSingle(),
    supabase.from('review_cycles').select('validity_expires_at').eq('id', cycleId).maybeSingle(),
  ]);
  if (!currentCase) throw new Error('Case not found.');
  if (currentCase.status !== 'Approved') {
    throw new Error(`Cannot record a negotiation outcome while the case is '${currentCase.status}' — it must be Approved.`);
  }

  if (outcome === 'accepted') {
    if (Number.isNaN(compositeDays) || compositeDays < 0) {
      throw new Error('Accepted composite credit days must be a non-negative number.');
    }
    await supabase.from('credit_cases').update({
      final_composite_credit_days: compositeDays,
      // Freeze the schedule the customer actually accepted — the terms
      // ladder and billing read this, not the mutable proposal.
      final_accepted_tranches: currentCase.proposed_tranches,
      final_review_cycle_id: cycleId,
      status: 'Accepted'
    }).eq('id', caseId);

    const daysPastExpiry = currentCycle?.validity_expires_at
      ? Math.max(0, Math.floor((Date.now() - new Date(currentCycle.validity_expires_at).getTime()) / 86_400_000))
      : 0;
    await logAuditEvent({
      case_id: caseId,
      event_type: 'counter_offer_accepted',
      actor_id: user.id,
      description: `Counter-offer accepted. Composite days: ${compositeDays}.${daysPastExpiry > 0 ? ` Acceptance recorded ${daysPastExpiry} day(s) after approval expiry.` : ''}`
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

  if (!BOARD_VOTE_DECISIONS.includes(decision as any)) {
    throw new Error('Invalid vote decision.');
  }
  await assertCanCastBoardVote(user, boardRoundId);

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
