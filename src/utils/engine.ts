import { createClient } from './supabase/server';
import { logAuditEvent } from './auth';

/**
 * Send a notification to a specific user.
 */
export async function sendNotification(userId: string, title: string, message: string) {
  if (!userId) return;
  const supabase = await createClient();
  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
  });
}

/**
 * Composite Credit Day calculation per Doc 04.
 * composite_credit_days = sum(weight_of_tranche * days_after_billing)
 */
export function calculateCompositeDays(
  tranches: Array<{ type: 'amount' | 'percentage'; value: number; days_after_billing: number }>,
  billAmount: number
): number {
  if (!tranches || tranches.length === 0 || billAmount <= 0) return 0;

  let totalWeight = 0;
  let weightedDays = 0;

  for (const tranche of tranches) {
    const weight = tranche.type === 'percentage'
      ? tranche.value / 100
      : tranche.value / billAmount;
    totalWeight += weight;
    weightedDays += weight * tranche.days_after_billing;
  }

  // Normalize if weights don't sum to 1
  if (totalWeight > 0 && Math.abs(totalWeight - 1) > 0.001) {
    weightedDays = weightedDays / totalWeight;
  }

  return Math.round(weightedDays * 100) / 100;
}

/**
 * Validate that tranches reconcile exactly to bill amount.
 */
export function validateTranches(
  tranches: Array<{ type: 'amount' | 'percentage'; value: number; days_after_billing: number }>,
  billAmount: number
): { valid: boolean; error?: string } {
  if (!tranches || tranches.length === 0) {
    return { valid: false, error: 'At least one tranche is required.' };
  }

  let totalValue = 0;
  for (const t of tranches) {
    if (t.type === 'amount') {
      totalValue += t.value;
    } else {
      totalValue += (t.value / 100) * billAmount;
    }
  }

  const diff = Math.abs(totalValue - billAmount);
  if (diff > 0.01) {
    return { valid: false, error: `Tranches total ${totalValue.toFixed(2)} but bill amount is ${billAmount.toFixed(2)}. They must reconcile exactly.` };
  }

  return { valid: true };
}

/**
 * Create a new credit case draft.
 */
export async function createCaseDraft(data: {
  case_scenario: string;
  customer_party_id?: string;
  contractor_party_id?: string;
  bill_amount: number;
  requested_exposure_amount: number;
  proposed_tranches: any[];
  branch_id?: string;
  case_attributes?: Record<string, any>;
  commercial_notes?: string;
  rm_user_id: string;
  kam_user_id?: string;
}) {
  const supabase = await createClient();

  const compositeDays = calculateCompositeDays(data.proposed_tranches, data.bill_amount);

  const { data: newCase, error } = await supabase
    .from('credit_cases')
    .insert({
      case_scenario: data.case_scenario,
      customer_party_id: data.customer_party_id,
      contractor_party_id: data.contractor_party_id,
      bill_amount: data.bill_amount,
      requested_exposure_amount: data.requested_exposure_amount,
      proposed_tranches: data.proposed_tranches,
      composite_credit_days: compositeDays,
      branch_id: data.branch_id,
      case_attributes: data.case_attributes,
      commercial_notes: data.commercial_notes,
      rm_user_id: data.rm_user_id,
      kam_user_id: data.kam_user_id,
      status: 'Draft',
    })
    .select()
    .maybeSingle();

  if (error || !newCase) throw error || new Error("Failed to create draft");

  await logAuditEvent({
    case_id: newCase.id,
    event_type: 'draft_created',
    actor_id: data.rm_user_id,
    description: 'Case draft created by RM.',
  });

  return newCase;
}

/**
 * Submit a draft case into review.
 * KAM becomes owner. A review cycle is opened with the current active policy snapshot.
 */
export async function submitCase(caseId: string, rmUserId: string) {
  const supabase = await createClient();

  // Get active policy
  const { data: activePolicy, error: policyErr } = await supabase
    .from('policy_versions')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (policyErr || !activePolicy) {
    throw new Error('No active policy version found. Cannot submit case.');
  }

  let createdCycleId: string | null = null;

  try {
    // Update case status
    const { error: updateErr } = await supabase
      .from('credit_cases')
      .update({
        status: 'In Review',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', caseId);

    if (updateErr) throw updateErr;

    // Determine correct cycle_number (in case of re-submission)
    const { count: existingCycleCount } = await supabase
      .from('review_cycles')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId);

    const cycleNumber = (existingCycleCount ?? 0) + 1;

    // Check routing thresholds to see if we can start at a later stage
    const { data: routingRules } = await supabase
      .from('routing_thresholds')
      .select('*')
      .eq('policy_version_id', activePolicy.id);

    let startingStage = 1;
    if (routingRules && routingRules.length > 0) {
      // Evaluate rules (simplified logic: check if billAmount < rule threshold)
      const { data: caseDetails } = await supabase.from('credit_cases').select('bill_amount').eq('id', caseId).single();
      const amount = caseDetails?.bill_amount || 0;

      for (const rule of routingRules) {
        if (rule.context_rule?.bill_amount_max && amount <= rule.context_rule.bill_amount_max) {
          startingStage = Math.max(startingStage, rule.target_stage);
        }
      }
    }

    // Create review cycle
    const { data: cycle, error: cycleErr } = await supabase
      .from('review_cycles')
      .insert({
        case_id: caseId,
        cycle_number: cycleNumber,
        policy_snapshot_id: activePolicy.id,
        active_stage: startingStage,
        is_active: true,
      })
      .select()
      .maybeSingle();

    if (cycleErr || !cycle) throw cycleErr || new Error("Failed to create review cycle");
    createdCycleId = cycle.id;

    // Generate all tasks for this Cycle
    await generateAllCycleTasks(cycle.id, activePolicy.id, caseId);

    await logAuditEvent({
      case_id: caseId,
      review_cycle_id: cycle.id,
      event_type: 'submission',
      actor_id: rmUserId,
      description: `Case submitted for review. Review Cycle ${cycleNumber} opened and all tasks generated.`,
    });

    const { data: creditCase, error: caseErr } = await supabase.from('credit_cases').select('case_number, kam_user_id').eq('id', caseId).maybeSingle();
    if (!caseErr && creditCase?.kam_user_id) {
      await sendNotification(creditCase.kam_user_id, 'New Case Assigned', `Case ${creditCase.case_number} has been submitted for review.`);
    }

    return cycle;
  } catch (error) {
    // Targeted rollback: only delete the specific cycle just created (not historical cycles)
    if (createdCycleId) {
      await supabase.from('stage_tasks').delete().eq('review_cycle_id', createdCycleId);
      await supabase.from('review_cycles').delete().eq('id', createdCycleId);
    }
    // Revert case status only if it was changed from Draft
    await supabase.from('credit_cases')
      .update({ status: 'Draft', submitted_at: null })
      .eq('id', caseId)
      .eq('status', 'In Review'); // Guard: only revert if we set it
    throw error;
  }
}

/**
 * Generate tasks for a specific stage based on policy definitions.
 */
export async function generateStageTasks(cycleId: string, stage: number, policyVersionId: string, caseId: string) {
  const supabase = await createClient();

  // 1. Get case scenario to filter subject types
  const { data: caseData, error: caseError } = await supabase
    .from('credit_cases')
    .select('case_scenario, history_classification, rm_user_id, case_attributes')
    .eq('id', caseId)
    .maybeSingle();

  if (caseError || !caseData) return;

  // 2. Map scenario to allowed subject types
  const allowedSubjects = ['case'];
  if (caseData.case_scenario === 'customer_name_customer_pays') {
    allowedSubjects.push('customer');
  } else if (caseData.case_scenario === 'contractor_name_contractor_pays') {
    allowedSubjects.push('contractor');
  } else if (caseData.case_scenario === 'customer_name_contractor_pays') {
    allowedSubjects.push('customer', 'contractor');
  }

  // 3. Fetch active parameters for this stage and policy + already-created task parameter IDs
  const [{ data: params }, { data: existingTasks }] = await Promise.all([
    supabase
      .from('parameter_definitions')
      .select('*')
      .eq('policy_version_id', policyVersionId)
      .eq('stage', stage)
      .eq('is_active', true)
      .in('subject_type', allowedSubjects),
    supabase
      .from('stage_tasks')
      .select('parameter_id')
      .eq('review_cycle_id', cycleId)
  ]);

  // Build a set of already-created parameter IDs to allow per-param backfill
  const alreadyCreatedParamIds = new Set((existingTasks ?? []).map((t: any) => t.parameter_id));

  // If ALL params are already created, skip entirely
  if (params && params.length > 0 && params.every((p: any) => alreadyCreatedParamIds.has(p.id))) return;
  if (!params || params.length === 0) return;

  // 4. Evaluate conditional logic (Doc 06)
  const finalTasks = [];
  for (const p of params) {
    let isApplicable = true;
    const isRequired = p.is_required;

    if (p.conditional_rules) {
      // Evaluate basic JSON conditional rules (scenarios, history_classification)
      if (p.conditional_rules.scenarios && Array.isArray(p.conditional_rules.scenarios)) {
        if (!p.conditional_rules.scenarios.includes(caseData.case_scenario)) {
          isApplicable = false;
        }
      }
      if (p.conditional_rules.history) {
        if (!caseData.history_classification || p.conditional_rules.history !== caseData.history_classification) {
          isApplicable = false;
        }
      }
    }

    if (isApplicable && !alreadyCreatedParamIds.has(p.id)) {
      // Skip if this specific parameter's task already exists (backfill protection)
      const isRmTask = p.default_owning_role?.toLowerCase() === 'rm';
      const draftAnswers = caseData.case_attributes?.draft_rm_answers || {};
      const answer = isRmTask ? draftAnswers[p.id] : null;

      finalTasks.push({
        review_cycle_id: cycleId,
        stage: stage,
        task_type: 'scoring',
        parameter_id: p.id,
        description: p.name,
        is_required: isRequired,
        status: answer ? 'Completed' : 'Pending',
        assigned_to: isRmTask ? caseData.rm_user_id : null,
        completed_by: answer ? caseData.rm_user_id : null,
        raw_input_value: answer?.raw_input_value || null,
        grade_value: answer?.grade_value != null ? answer.grade_value : null,
        reason: answer?.reason || null,
        sla_deadline: p.sla_days ? new Date(Date.now() + p.sla_days * 86400000).toISOString() : null,
      });
    }
  }

  if (finalTasks.length > 0) {
    const { error } = await supabase.from('stage_tasks').insert(finalTasks);
    if (error) {
      console.error('Error generating stage tasks:', error.message);
      throw error;
    }
  }
}

/**
 * Generate all tasks for a review cycle upfront.
 */
export async function generateAllCycleTasks(cycleId: string, policyVersionId: string, caseId: string) {
  await Promise.all([1, 2, 3].map(s => generateStageTasks(cycleId, s, policyVersionId, caseId)));
}

/**
 * Progress a case from one stage to the next.
 */
export async function progressStage(cycleId: string, currentStage: number, actorId: string) {
  const supabase = await createClient();
  const nextStage = currentStage + 1;

  if (nextStage > 3) {
    throw new Error('Cannot progress beyond Stage 3.');
  }

  // Validate that all required, non-waived tasks for the current stage are completed
  const { data: incompleteTasks, error: errIncomplete } = await supabase
    .from('stage_tasks')
    .select('id')
    .eq('review_cycle_id', cycleId)
    .eq('stage', currentStage)
    .eq('is_required', true)
    .neq('status', 'Completed')
    .neq('is_waived', true);

  if (errIncomplete) throw errIncomplete;

  if (incompleteTasks && incompleteTasks.length > 0) {
    throw new Error(`Cannot progress to Stage ${nextStage}. There are ${incompleteTasks.length} required tasks pending in Stage ${currentStage}.`);
  }

  // Check stage readiness
  const { data: readiness, error: readinessErr } = await supabase
    .from('stage_readiness')
    .select('is_ready')
    .eq('review_cycle_id', cycleId)
    .eq('stage', currentStage)
    .maybeSingle();

  if (readinessErr) throw readinessErr;
  if (readiness && !readiness.is_ready) {
    throw new Error(`Cannot progress to Stage ${nextStage}. Stage ${currentStage} is not marked as ready.`);
  }

  const { data: cycle, error: cycleErr } = await supabase
    .from('review_cycles')
    .select('case_id, policy_snapshot_id')
    .eq('id', cycleId)
    .maybeSingle();

  if (cycleErr || !cycle) throw new Error('Review cycle not found.');

  await supabase
    .from('review_cycles')
    .update({ active_stage: nextStage })
    .eq('id', cycleId);

  await logAuditEvent({
    case_id: cycle.case_id,
    review_cycle_id: cycleId,
    event_type: 'stage_transition',
    actor_id: actorId,
    description: `Progressed from Stage ${currentStage} to Stage ${nextStage}.`,
  });

  const { data: creditCase, error: caseErr } = await supabase.from('credit_cases').select('case_number, rm_user_id').eq('id', cycle.case_id).maybeSingle();
  if (!caseErr && creditCase?.rm_user_id) {
    await sendNotification(creditCase.rm_user_id, 'Stage Progressed', `Case ${creditCase.case_number} progressed to Stage ${nextStage}.`);
  }
}

/**
 * Set a case or task to waiting state, pausing SLA.
 */
export async function setWaiting(params: {
  type: 'case' | 'task';
  id: string;
  reason: string;
  actorId: string;
  caseId: string;
}) {
  const supabase = await createClient();

  if (params.type === 'task') {
    await supabase.from('stage_tasks').update({
      is_waiting: true,
      waiting_reason: params.reason,
      waiting_started_at: new Date().toISOString(),
    }).eq('id', params.id);
  } else {
    await supabase.from('credit_cases').update({
      status: 'Awaiting Input',
      substatus: params.reason,
    }).eq('id', params.id);
  }

  await logAuditEvent({
    case_id: params.caseId,
    event_type: 'waiting_started',
    actor_id: params.actorId,
    description: `${params.type === 'task' ? 'Task' : 'Case'} set to waiting: ${params.reason}`,
  });
}

/**
 * Return a case for revision.
 */
export async function returnForRevision(params: {
  caseId: string;
  cycleId: string;
  comment: string;
  actorId: string;
}) {
  const supabase = await createClient();

  await supabase.from('credit_cases').update({
    status: 'In Review',
    substatus: 'Returned for revision',
  }).eq('id', params.caseId);

  await logAuditEvent({
    case_id: params.caseId,
    review_cycle_id: params.cycleId,
    event_type: 'return_revision',
    actor_id: params.actorId,
    description: `Returned for revision: ${params.comment}`,
  });

  const { data: creditCase, error: caseErr } = await supabase.from('credit_cases').select('case_number, rm_user_id').eq('id', params.caseId).maybeSingle();
  if (!caseErr && creditCase?.rm_user_id) {
    await sendNotification(creditCase.rm_user_id, 'Case Returned', `Case ${creditCase.case_number} was returned for revision.`);
  }
}

/**
 * Withdraw a case.
 */
export async function withdrawCase(params: {
  caseId: string;
  reason: string;
  note: string;
  actorId: string;
}) {
  const supabase = await createClient();

  await supabase.from('credit_cases').update({
    status: 'Withdrawn',
    closure_reason: params.reason,
    closure_note: params.note,
  }).eq('id', params.caseId);

  // Close active cycle
  await supabase.from('review_cycles').update({
    is_active: false,
    decision: 'withdrawn',
  }).eq('case_id', params.caseId).eq('is_active', true);

  await logAuditEvent({
    case_id: params.caseId,
    event_type: 'withdrawal',
    actor_id: params.actorId,
    description: `Case withdrawn. Reason: ${params.reason}. Note: ${params.note}`,
  });

  const { data: creditCase, error: caseErr } = await supabase.from('credit_cases').select('case_number, rm_user_id').eq('id', params.caseId).maybeSingle();
  if (!caseErr && creditCase?.rm_user_id) {
    await sendNotification(creditCase.rm_user_id, 'Case Withdrawn', `Case ${creditCase.case_number} has been withdrawn.`);
  }
}
export async function checkAndApplyAutoEscalation(caseId: string) {
  const supabase = await createClient();
  const { data: thresholds } = await supabase.from('admin_enumerations').select('value').eq('category', 'auto_escalation_days').limit(1).maybeSingle();
  const thresholdDays = parseInt(thresholds?.value || '7');

  const { data: c } = await supabase.from('credit_cases').select('status, submitted_at, escalation_level').eq('id', caseId).maybeSingle();
  if (!c || c.status === 'Closed' || !c.submitted_at) return;

  const daysSinceSubmit = (new Date().getTime() - new Date(c.submitted_at).getTime()) / (1000 * 3600 * 24);

  if (daysSinceSubmit > thresholdDays && (c.escalation_level || 0) === 0) {
    await supabase.from('credit_cases').update({ escalation_level: 1 }).eq('id', caseId);
    await supabase.from('escalations').insert({
      case_id: caseId,
      assigned_to: null,
      escalation_reason: `Auto-escalated due to exceeding SLA of ${thresholdDays} days.`,
      status: 'open'
    });
  }
}
