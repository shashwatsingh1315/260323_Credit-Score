import { createClient } from './supabase/server';
import { evaluateRequiredStage } from './routing';

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

  // 1. Get cycle to identify persona and policy
  const { data: cycle, error: cycleError } = await supabase
    .from('review_cycles')
    .select('policy_snapshot_id, customer_persona_id, contractor_persona_id')
    .eq('id', params.reviewCycleId)
    .maybeSingle();

  if (cycleError || !cycle) return 0;

  const personaId = params.subjectType === 'customer' 
    ? cycle.customer_persona_id 
    : cycle.contractor_persona_id;

  // 2. Fetch completed scoring tasks for this subject type at this stage
  const { data: tasks } = await supabase
    .from('stage_tasks')
    .select('*, parameter:parameter_definitions(*)')
    .eq('review_cycle_id', params.reviewCycleId)
    .eq('stage', params.stage)
    .eq('task_type', 'scoring')
    .not('grade_value', 'is', null);

  if (!tasks || tasks.length === 0) return 0;

  // 3. Fetch weight overrides for the persona if applicable
  let weightsMap: Record<string, number> = {};
  if (personaId) {
    const { data: overrides } = await supabase
      .from('weight_matrices')
      .select('parameter_id, weight')
      .eq('persona_id', personaId);
    
    if (overrides) {
      overrides.forEach(o => {
        const weightNum = parseFloat(o.weight as string);
        if (isNaN(weightNum)) throw new Error("Invalid weight");
        weightsMap[o.parameter_id] = weightNum;
      });
    }
  }

  // Filter to the correct subject type
  const relevantTasks = tasks.filter(
    (t: any) => t.parameter?.subject_type === params.subjectType
  );

  let weightedSum = 0;
  for (const task of relevantTasks) {
    // ?? not ||: a configured weight of 0 means "excluded", not "default to 1"
    const defaultWeight = task.parameter?.weight ?? 1;
    const weight = weightsMap[task.parameter_id] ?? defaultWeight;
    const grade = task.grade_value || 0;
    weightedSum += grade * weight;
  }

  return weightedSum;
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
  const supabase = await createClient();

  // 1. Get cycle to identify policy
  const { data: cycle, error: cycleError } = await supabase
    .from('review_cycles')
    .select('policy_snapshot_id')
    .eq('id', params.reviewCycleId)
    .maybeSingle();

  if (cycleError || !cycle) return 0;

  // Stages are independent — score them in parallel (CLAUDE.md constraint)
  const stageScores = await Promise.all(
    Array.from({ length: params.upToStage }, (_, i) =>
      calculateSubjectScore({
        reviewCycleId: params.reviewCycleId,
        subjectType: params.subjectType,
        stage: i + 1,
      })
    )
  );
  const weightedSum = stageScores.reduce((sum, s) => sum + s, 0);

  // Fetch max total for the cumulative stage
  const { data: maxTotal, error: maxTotalError } = await supabase
    .from('stage_max_totals')
    .select('max_total')
    .eq('policy_version_id', cycle.policy_snapshot_id)
    .eq('stage', params.upToStage)
    .maybeSingle();

  const maxTotalValue = maxTotal?.max_total || 100;
  if (maxTotalValue <= 0) return 0; // Guard against division by zero

  const cappedSum = Math.min(weightedSum, maxTotalValue);
  const normalizedScore = (cappedSum / maxTotalValue) * 100;
  return Math.round(normalizedScore);
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

  // Customer score, contractor score (context-only scenarios skip it), and the
  // cycle's dominance selection are independent — fetch in parallel.
  const [customerScore, contractorScore, { data: cycle, error: cycleError }] = await Promise.all([
    calculateCumulativeScore({
      reviewCycleId: params.reviewCycleId,
      subjectType: 'customer',
      upToStage: params.upToStage,
    }),
    params.caseScenario !== 'customer_name_customer_pays'
      ? calculateCumulativeScore({
          reviewCycleId: params.reviewCycleId,
          subjectType: 'contractor',
          upToStage: params.upToStage,
        })
      : Promise.resolve(0),
    supabase
      .from('review_cycles')
      .select('dominance_category_id')
      .eq('id', params.reviewCycleId)
      .maybeSingle(),
  ]);

  let finalScore: number;

  if (!cycleError && cycle?.dominance_category_id) {
    const { data: dom, error: domError } = await supabase
      .from('dominance_categories')
      .select('*')
      .eq('id', cycle.dominance_category_id)
      .maybeSingle();

    if (!domError && dom) {
      switch (dom.combination_method) {
        case 'customer_only':
          finalScore = customerScore;
          break;
        case 'contractor_only':
          finalScore = contractorScore;
          break;
        case 'power_law':
          const exp = dom.exponent > 0 ? dom.exponent : 1;
          const clampedCustomer = Math.max(0, Math.min(100, customerScore));
          const clampedContractor = Math.max(0, Math.min(100, contractorScore));
          finalScore = Math.pow(
            Math.pow(clampedCustomer, dom.customer_weight) * Math.pow(clampedContractor, dom.contractor_weight),
            1 / exp
          );
          break;
        case 'weighted':
        default:
          finalScore = (customerScore * dom.customer_weight) + (contractorScore * dom.contractor_weight);
          break;
      }
    } else {
      // Dominance row missing/broken — fall back to scenario defaults rather
      // than blindly using the customer score (wrong for contractor-name cases)
      finalScore = scenarioDefaultScore(params.caseScenario, customerScore, contractorScore);
    }
  } else {
    // No dominance selected — use scenario defaults
    finalScore = scenarioDefaultScore(params.caseScenario, customerScore, contractorScore);
  }

  return {
    customerScore,
    contractorScore,
    finalScore: Math.round(finalScore * 100) / 100,
  };
}

function scenarioDefaultScore(caseScenario: string, customerScore: number, contractorScore: number): number {
  if (caseScenario === 'customer_name_customer_pays') return customerScore;
  if (caseScenario === 'contractor_name_contractor_pays') return contractorScore;
  return (customerScore * 0.5) + (contractorScore * 0.5);
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
  /** Only consider tasks up to this stage. Tasks for all stages are generated
   *  upfront, so without this bound every early-stage case looks ambiguous. */
  upToStage?: number;
  /** Pass a band already fetched for this score to avoid a duplicate query. */
  precomputedBand?: { bandName: string; approvedDays: number; isAmbiguity: boolean } | null;
  subjectScores?: { customer?: number; contractor?: number };
}): Promise<{ isAmbiguous: boolean; reasons: string[] }> {
  const supabase = await createClient();
  const reasons: string[] = [];

  // Check score band
  const bandResult = params.precomputedBand !== undefined
    ? params.precomputedBand
    : await mapScoreToCreditDays({
        policyVersionId: params.policyVersionId,
        score: params.score,
      });

  if (bandResult?.isAmbiguity) {
    reasons.push(`Score ${params.score} falls in ambiguity band "${bandResult.bandName}".`);
  }

  // Check missing critical parameters
  let query = supabase
    .from('stage_tasks')
    .select('description, parameter:parameter_definitions(name, is_critical)')
    .eq('review_cycle_id', params.reviewCycleId)
    .eq('task_type', 'scoring')
    .is('grade_value', null);
  if (params.upToStage != null) query = query.lte('stage', params.upToStage);
  const { data: incompleteCritical, error: incompleteError } = await query;

  if (incompleteError) throw new Error(incompleteError.message);

  const missingCritical = (incompleteCritical || []).filter(
    (t: any) => t.parameter?.is_critical
  );

  if (missingCritical.length > 0) {
    reasons.push(`${missingCritical.length} critical parameter(s) are incomplete.`);
  }

  if (params.subjectScores) {
    const { data: cycle } = await supabase
      .from('review_cycles')
      .select('customer_persona_id, contractor_persona_id')
      .eq('id', params.reviewCycleId)
      .maybeSingle();
    const personaIds = [cycle?.customer_persona_id, cycle?.contractor_persona_id].filter(Boolean) as string[];
    if (personaIds.length > 0) {
      const { data: personas } = await supabase.from('personas').select('id, name, minimum_score').in('id', personaIds);
      const personaById = new Map((personas || []).map((persona: any) => [persona.id, persona]));
      for (const subject of ['customer', 'contractor'] as const) {
        const personaId = cycle?.[`${subject}_persona_id`];
        const persona: any = personaId ? personaById.get(personaId) : null;
        const score = params.subjectScores[subject];
        if (persona?.minimum_score != null && score != null && score < Number(persona.minimum_score)) {
          reasons.push(`${subject === 'customer' ? 'Customer' : 'Contractor'} score ${score} is below persona '${persona.name}' minimum ${persona.minimum_score}.`);
        }
      }
    }
  }

  return {
    isAmbiguous: reasons.length > 0,
    reasons,
  };
}

/**
 * Triggered after task completion to keep the review_cycles.current_case_score in sync.
 */
export async function updateCycleScore(reviewCycleId: string) {
  const supabase = await createClient();
  const { data: cycle, error: cycleError } = await supabase
    .from('review_cycles')
    .select('*, credit_cases(case_scenario, requested_exposure_amount)')
    .eq('id', reviewCycleId)
    .maybeSingle();

  if (cycleError || !cycle) return;

  const caseScenario = (cycle.credit_cases as any)?.case_scenario || 'customer_name_customer_pays';
  
  // Calculate final score up to the active stage
  const result = await calculateFinalCaseScore({
    reviewCycleId,
    caseScenario,
    upToStage: cycle.active_stage,
  });

  const bandResult = await mapScoreToCreditDays({
    policyVersionId: cycle.policy_snapshot_id,
    score: result.finalScore,
  });

  // Full ambiguity rule (band OR missing critical parameters) — must match
  // what the simulation preview shows, or live cases behave differently.
  const ambiguity = await checkAmbiguity({
    reviewCycleId,
    policyVersionId: cycle.policy_snapshot_id,
    score: result.finalScore,
    upToStage: cycle.active_stage,
    precomputedBand: bandResult,
    subjectScores: { customer: result.customerScore, contractor: result.contractorScore },
  });

  const { data: routingRules } = await supabase
    .from('routing_thresholds')
    .select('context_rule, target_stage')
    .eq('policy_version_id', cycle.policy_snapshot_id);
  const evaluatedStage = evaluateRequiredStage(routingRules || [], {
    exposure: Number((cycle.credit_cases as any)?.requested_exposure_amount) || 0,
    scenario: caseScenario,
    score: result.finalScore,
  });
  const storedStage = cycle.required_stage == null ? 3 : Number(cycle.required_stage);
  const requiredStage = Math.max(storedStage, evaluatedStage);

  await supabase.from('review_cycles').update({
    current_customer_score: result.customerScore,
    current_contractor_score: result.contractorScore,
    current_case_score: result.finalScore,
    approved_credit_days: bandResult?.approvedDays ?? null,
    score_band_name: bandResult?.bandName ?? null,
    is_ambiguous: ambiguity.isAmbiguous,
    ...(requiredStage > storedStage ? { required_stage: requiredStage } : {}),
  }).eq('id', reviewCycleId);
}
