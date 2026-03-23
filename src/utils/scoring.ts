import { createClient } from './supabase/server';

/**
 * Real scoring engine per Doc 06.
 * 
 * Calculates: weighted_sum = sum(parameter_grade_value * parameter_weight)
 * Then:       normalized_score = weighted_sum / configured_model_max_total
 *
 * This runs per subject (customer or contractor) per stage.
 */
export async function calculateSubjectScore(params: {
  reviewCycleId: string;
  subjectType: 'customer' | 'contractor';
  stage: number;
}): Promise<number> {
  const supabase = await createClient();

  // Get completed scoring tasks for this subject type at this stage
  const { data: tasks } = await supabase
    .from('stage_tasks')
    .select('*, parameter:parameter_definitions(*)')
    .eq('review_cycle_id', params.reviewCycleId)
    .eq('stage', params.stage)
    .eq('task_type', 'scoring')
    .not('grade_value', 'is', null);

  if (!tasks || tasks.length === 0) return 0;

  // Filter to the correct subject type
  const relevantTasks = tasks.filter(
    (t: any) => t.parameter?.subject_type === params.subjectType
  );

  let weightedSum = 0;
  for (const task of relevantTasks) {
    const weight = task.parameter?.weight || 1;
    const grade = task.grade_value || 0;
    weightedSum += grade * weight;
  }

  // Get stage max total for normalization
  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('policy_snapshot_id')
    .eq('id', params.reviewCycleId)
    .single();

  if (!cycle) return 0;

  const { data: maxTotal } = await supabase
    .from('stage_max_totals')
    .select('max_total')
    .eq('policy_version_id', cycle.policy_snapshot_id)
    .eq('stage', params.stage)
    .single();

  const maxTotalValue = maxTotal?.max_total || 100;
  const normalizedScore = (weightedSum / maxTotalValue) * 100;

  return Math.round(normalizedScore * 100) / 100;
}

/**
 * Calculate cumulative score across stages for a subject.
 * Stage 2 adds to Stage 1, Stage 3 adds to both.
 */
export async function calculateCumulativeScore(params: {
  reviewCycleId: string;
  subjectType: 'customer' | 'contractor';
  upToStage: number;
}): Promise<number> {
  let totalScore = 0;

  for (let stage = 1; stage <= params.upToStage; stage++) {
    const stageScore = await calculateSubjectScore({
      reviewCycleId: params.reviewCycleId,
      subjectType: params.subjectType,
      stage,
    });
    totalScore += stageScore;
  }

  return totalScore;
}

/**
 * Combine customer and contractor scores using dominance matrix.
 * Per Doc 06: scenario + dominance matrix → final case score.
 */
export async function calculateFinalCaseScore(params: {
  reviewCycleId: string;
  caseScenario: string;
  upToStage: number;
}): Promise<{
  customerScore: number;
  contractorScore: number;
  finalScore: number;
}> {
  const supabase = await createClient();

  const customerScore = await calculateCumulativeScore({
    reviewCycleId: params.reviewCycleId,
    subjectType: 'customer',
    upToStage: params.upToStage,
  });

  // For "contractor_name_contractor_pays", customer is context-only
  let contractorScore = 0;
  if (params.caseScenario !== 'customer_name_customer_pays') {
    contractorScore = await calculateCumulativeScore({
      reviewCycleId: params.reviewCycleId,
      subjectType: 'contractor',
      upToStage: params.upToStage,
    });
  }

  // Get dominance category for this cycle
  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('dominance_category_id')
    .eq('id', params.reviewCycleId)
    .single();

  let finalScore: number;

  if (cycle?.dominance_category_id) {
    const { data: dom } = await supabase
      .from('dominance_categories')
      .select('*')
      .eq('id', cycle.dominance_category_id)
      .single();

    if (dom) {
      switch (dom.combination_method) {
        case 'customer_only':
          finalScore = customerScore;
          break;
        case 'contractor_only':
          finalScore = contractorScore;
          break;
        case 'power_law':
          finalScore = Math.pow(
            Math.pow(customerScore, dom.customer_weight) * Math.pow(Math.max(contractorScore, 1), dom.contractor_weight),
            1 / dom.exponent
          );
          break;
        case 'weighted':
        default:
          finalScore = (customerScore * dom.customer_weight) + (contractorScore * dom.contractor_weight);
          break;
      }
    } else {
      finalScore = customerScore; // fallback
    }
  } else {
    // No dominance selected — use scenario defaults
    if (params.caseScenario === 'customer_name_customer_pays') {
      finalScore = customerScore;
    } else if (params.caseScenario === 'contractor_name_contractor_pays') {
      finalScore = contractorScore;
    } else {
      finalScore = (customerScore * 0.5) + (contractorScore * 0.5);
    }
  }

  return {
    customerScore,
    contractorScore,
    finalScore: Math.round(finalScore * 100) / 100,
  };
}

/**
 * Map final score to approved credit days using score bands.
 */
export async function mapScoreToCreditDays(params: {
  policyVersionId: string;
  score: number;
}): Promise<{
  bandName: string;
  approvedDays: number;
  isAmbiguity: boolean;
} | null> {
  const supabase = await createClient();

  const { data: bands } = await supabase
    .from('score_bands')
    .select('*')
    .eq('policy_version_id', params.policyVersionId)
    .order('min_score', { ascending: false });

  if (!bands) return null;

  for (const band of bands) {
    if (params.score >= band.min_score && params.score <= band.max_score) {
      return {
        bandName: band.band_name,
        approvedDays: band.approved_credit_days,
        isAmbiguity: band.is_ambiguity_band,
      };
    }
  }

  return null;
}

/**
 * Check if a case is ambiguous (Doc 06).
 * Ambiguous when: score in ambiguity band OR missing critical signals.
 */
export async function checkAmbiguity(params: {
  reviewCycleId: string;
  policyVersionId: string;
  score: number;
}): Promise<{ isAmbiguous: boolean; reasons: string[] }> {
  const supabase = await createClient();
  const reasons: string[] = [];

  // Check score band
  const bandResult = await mapScoreToCreditDays({
    policyVersionId: params.policyVersionId,
    score: params.score,
  });

  if (bandResult?.isAmbiguity) {
    reasons.push(`Score ${params.score} falls in ambiguity band "${bandResult.bandName}".`);
  }

  // Check missing critical parameters
  const { data: incompleteCritical } = await supabase
    .from('stage_tasks')
    .select('description, parameter:parameter_definitions(name, is_critical)')
    .eq('review_cycle_id', params.reviewCycleId)
    .eq('task_type', 'scoring')
    .is('grade_value', null);

  const missingCritical = (incompleteCritical || []).filter(
    (t: any) => t.parameter?.is_critical
  );

  if (missingCritical.length > 0) {
    reasons.push(`${missingCritical.length} critical parameter(s) are incomplete.`);
  }

  return {
    isAmbiguous: reasons.length > 0,
    reasons,
  };
}
