import { createClient } from './supabase/server';
import { logAuditEvent } from './auth';

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
  case_attributes?: Record<string, string>;
  commercial_notes?: string;
  rm_user_id: string;
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
      status: 'Draft',
    })
    .select()
    .single();

  if (error) throw error;

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
  const { data: activePolicy } = await supabase
    .from('policy_versions')
    .select('id')
    .eq('is_active', true)
    .single();

  if (!activePolicy) {
    throw new Error('No active policy version found. Cannot submit case.');
  }

  // Update case status
  const { error: updateErr } = await supabase
    .from('credit_cases')
    .update({
      status: 'In Review',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', caseId);

  if (updateErr) throw updateErr;

  // Create review cycle
  const { data: cycle, error: cycleErr } = await supabase
    .from('review_cycles')
    .insert({
      case_id: caseId,
      cycle_number: 1,
      policy_snapshot_id: activePolicy.id,
      active_stage: 1,
      is_active: true,
    })
    .select()
    .single();

  if (cycleErr) throw cycleErr;
  
  // Generate tasks for Stage 1
  await generateStageTasks(cycle.id, 1, activePolicy.id, caseId);

  await logAuditEvent({
    case_id: caseId,
    review_cycle_id: cycle.id,
    event_type: 'submission',
    actor_id: rmUserId,
    description: 'Case submitted for review. Review Cycle 1 opened and tasks generated.',
  });

  return cycle;
}

/**
 * Generate tasks for a specific stage based on policy definitions.
 */
export async function generateStageTasks(cycleId: string, stage: number, policyVersionId: string, caseId: string) {
  const supabase = await createClient();

  // 1. Get case scenario to filter subject types
  const { data: caseData } = await supabase
    .from('credit_cases')
    .select('case_scenario, history_classification')
    .eq('id', caseId)
    .single();

  if (!caseData) return;

  // 2. Map scenario to allowed subject types
  const allowedSubjects = ['case'];
  if (caseData.case_scenario === 'customer_name_customer_pays') {
    allowedSubjects.push('customer');
  } else if (caseData.case_scenario === 'contractor_name_contractor_pays') {
    allowedSubjects.push('contractor');
  } else if (caseData.case_scenario === 'customer_name_contractor_pays') {
    allowedSubjects.push('customer', 'contractor');
  }

  // 3. Fetch active parameters for this stage and policy
  const { data: params } = await supabase
    .from('parameter_definitions')
    .select('*')
    .eq('policy_version_id', policyVersionId)
    .eq('stage', stage)
    .eq('is_active', true)
    .in('subject_type', allowedSubjects);

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
      if (p.conditional_rules.history && caseData.history_classification) {
        if (p.conditional_rules.history !== caseData.history_classification) {
          isApplicable = false;
        }
      }
    }

    if (isApplicable) {
      finalTasks.push({
        review_cycle_id: cycleId,
        stage: stage,
        task_type: 'scoring',
        parameter_id: p.id,
        description: p.name,
        is_required: isRequired,
        status: 'Pending',
      });
    }
  }

  if (finalTasks.length > 0) {
    const { error } = await supabase.from('stage_tasks').insert(finalTasks);
    if (error) console.error('Error generating stage tasks:', error.message);
  }
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

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('case_id, policy_snapshot_id')
    .eq('id', cycleId)
    .single();

  if (!cycle) throw new Error('Review cycle not found.');

  await supabase
    .from('review_cycles')
    .update({ active_stage: nextStage })
    .eq('id', cycleId);

  // Generate tasks for next stage
  await generateStageTasks(cycleId, nextStage, cycle.policy_snapshot_id, cycle.case_id);

  await logAuditEvent({
    case_id: cycle.case_id,
    review_cycle_id: cycleId,
    event_type: 'stage_transition',
    actor_id: actorId,
    description: `Progressed from Stage ${currentStage} to Stage ${nextStage} and tasks generated.`,
  });
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
    status: 'Closed',
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
}
