import { createClient } from './supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Preapproved credit-days band for a party at a specific role under the active policy.
// Computed without a review_cycle by leaning on stable params (sourced from
// party_parameter_values) and bounding per-case params at min/max grades.

export type PartyRole = 'customer' | 'contractor';

export interface PreapprovedBand {
  partyId: string;
  partyRole: PartyRole;
  policyVersionId: string | null;
  policyMinDays: number | null;
  policyMaxDays: number | null;
  empiricalMinDays: number | null;
  empiricalMaxDays: number | null;
  stableParamCoveragePct: number;
  closedCaseCount: number;
  sufficientHistory: boolean;
  computedAt: string;
}

type ParamRow = {
  id: string;
  weight: number;
  stage: number;
  is_stable: boolean;
  subject_type: string;
};

// ── Public API ───────────────────────────────────────────────────────────────

export async function getPreapprovedBand(
  partyId: string,
  role: PartyRole,
): Promise<PreapprovedBand | null> {
  const supabase = await createClient();
  const policyVersionId = await getActivePolicyId(supabase);
  if (!policyVersionId) return null;

  const { data } = await supabase
    .from('party_preapproved_bands')
    .select('*')
    .eq('party_id', partyId)
    .eq('party_role', role)
    .eq('policy_version_id', policyVersionId)
    .maybeSingle();

  return data ? rowToBand(data) : null;
}

export async function refreshPreapprovedBand(
  partyId: string,
  role: PartyRole,
): Promise<PreapprovedBand | null> {
  const supabase = await createClient();
  const policyVersionId = await getActivePolicyId(supabase);
  if (!policyVersionId) return null;

  const [params, gradeMax, stageMaxTotal, thresholds, ppv, closedCases] = await Promise.all([
    fetchActiveParams(supabase, policyVersionId, role),
    fetchMaxGrade(supabase, policyVersionId),
    fetchStageMaxTotal(supabase, policyVersionId, 3),
    fetchThresholds(supabase),
    fetchPartyParameterValues(supabase, partyId),
    fetchClosedCaseDays(supabase, partyId, role),
  ]);

  const bounds = computeBounds({ params, gradeMax, stageMaxTotal, partyParameterValues: ppv });

  // Map both bounds through score_bands. Read bands once, lookup in memory.
  const { data: bands } = await supabase
    .from('score_bands')
    .select('min_score, max_score, approved_credit_days')
    .eq('policy_version_id', policyVersionId)
    .order('min_score', { ascending: false });

  const policyMinDays = bounds.totalStableWeight > 0 ? mapDays(bands || [], bounds.minNormalized) : null;
  const policyMaxDays = bounds.totalStableWeight > 0 ? mapDays(bands || [], bounds.maxNormalized) : null;

  const sufficientHistory =
    closedCases.count >= thresholds.minClosedCases &&
    bounds.coveragePct >= thresholds.minCoveragePct &&
    bounds.totalStableWeight > 0;

  // Safety invariant
  if (policyMinDays !== null && policyMaxDays !== null && policyMinDays > policyMaxDays) {
    console.warn(
      `[preapproval] min > max for party ${partyId} role ${role}: ${policyMinDays} > ${policyMaxDays}`,
    );
  }

  const row = {
    party_id: partyId,
    party_role: role,
    policy_version_id: policyVersionId,
    policy_min_days: policyMinDays,
    policy_max_days: policyMaxDays,
    empirical_min_days: closedCases.minDays,
    empirical_max_days: closedCases.maxDays,
    stable_param_coverage_pct: Number(bounds.coveragePct.toFixed(2)),
    closed_case_count: closedCases.count,
    sufficient_history: sufficientHistory,
    computed_at: new Date().toISOString(),
  };

  const { data: upserted, error } = await supabase
    .from('party_preapproved_bands')
    .upsert(row, { onConflict: 'party_id,party_role,policy_version_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[preapproval] upsert failed', error);
    return null;
  }

  return rowToBand(upserted);
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export function computeBounds(args: {
  params: ParamRow[];
  gradeMax: number;
  stageMaxTotal: number;
  partyParameterValues: Map<string, number>;
}): { minNormalized: number; maxNormalized: number; coveragePct: number; totalStableWeight: number } {
  const { params, gradeMax, stageMaxTotal, partyParameterValues } = args;

  let minSum = 0;
  let maxSum = 0;
  let totalStableWeight = 0;
  let resolvedStableWeight = 0;

  for (const p of params) {
    const w = Number(p.weight) || 0;
    if (p.is_stable) {
      totalStableWeight += w;
      const resolved = partyParameterValues.get(p.id);
      if (resolved !== undefined && resolved !== null) {
        resolvedStableWeight += w;
        minSum += resolved * w;
        maxSum += resolved * w;
      }
      // If unresolved: contributes 0 to both bounds (conservative).
    } else {
      // Per-case parameter: floor at 0 contribution (min), ceiling at gradeMax * w (max).
      maxSum += w * gradeMax;
    }
  }

  const cappedMin = Math.min(minSum, stageMaxTotal);
  const cappedMax = Math.min(maxSum, stageMaxTotal);
  const minNormalized = stageMaxTotal > 0 ? (cappedMin / stageMaxTotal) * 100 : 0;
  const maxNormalized = stageMaxTotal > 0 ? (cappedMax / stageMaxTotal) * 100 : 0;
  const coveragePct = totalStableWeight > 0 ? (resolvedStableWeight / totalStableWeight) * 100 : 0;

  return { minNormalized, maxNormalized, coveragePct, totalStableWeight };
}

export function mapDays(
  bands: { min_score: number; max_score: number; approved_credit_days: number }[],
  score: number,
): number | null {
  for (const b of bands) {
    if (score >= b.min_score && score <= b.max_score) return b.approved_credit_days;
  }
  return null;
}

// ── Internal lookups ─────────────────────────────────────────────────────────

async function getActivePolicyId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('policy_versions')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  return data?.id ?? null;
}

async function fetchActiveParams(
  supabase: SupabaseClient,
  policyVersionId: string,
  role: PartyRole,
): Promise<ParamRow[]> {
  const { data } = await supabase
    .from('parameter_definitions')
    .select('id, weight, stage, is_stable, subject_type')
    .eq('policy_version_id', policyVersionId)
    .eq('subject_type', role)
    .eq('is_active', true);
  return (data || []) as ParamRow[];
}

async function fetchMaxGrade(supabase: SupabaseClient, policyVersionId: string): Promise<number> {
  const { data } = await supabase
    .from('grade_scale')
    .select('grade_value')
    .eq('policy_version_id', policyVersionId)
    .order('grade_value', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.grade_value ?? 5;
}

async function fetchStageMaxTotal(
  supabase: SupabaseClient,
  policyVersionId: string,
  stage: number,
): Promise<number> {
  const { data } = await supabase
    .from('stage_max_totals')
    .select('max_total')
    .eq('policy_version_id', policyVersionId)
    .eq('stage', stage)
    .maybeSingle();
  const v = data?.max_total ?? 100;
  return Number(v) || 100;
}

async function fetchThresholds(
  supabase: SupabaseClient,
): Promise<{ minClosedCases: number; minCoveragePct: number }> {
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['MIN_CLOSED_CASES_FOR_PREAPPROVAL', 'MIN_STABLE_COVERAGE_PCT_FOR_PREAPPROVAL']);
  const map = new Map<string, number>();
  for (const r of data || []) map.set(r.key as string, Number(r.value));
  return {
    minClosedCases: map.get('MIN_CLOSED_CASES_FOR_PREAPPROVAL') ?? 2,
    minCoveragePct: map.get('MIN_STABLE_COVERAGE_PCT_FOR_PREAPPROVAL') ?? 60,
  };
}

async function fetchPartyParameterValues(
  supabase: SupabaseClient,
  partyId: string,
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('party_parameter_values')
    .select('parameter_id, grade_value')
    .eq('party_id', partyId)
    .not('grade_value', 'is', null);
  const m = new Map<string, number>();
  for (const r of data || []) m.set(r.parameter_id as string, Number(r.grade_value));
  return m;
}

async function fetchClosedCaseDays(
  supabase: SupabaseClient,
  partyId: string,
  role: PartyRole,
): Promise<{ minDays: number | null; maxDays: number | null; count: number }> {
  const roleColumn = role === 'customer' ? 'customer_party_id' : 'contractor_party_id';
  const { data } = await supabase
    .from('credit_cases')
    .select('composite_credit_days, final_composite_credit_days')
    .eq('status', 'Closed')
    .eq(roleColumn, partyId);

  if (!data || data.length === 0) return { minDays: null, maxDays: null, count: 0 };

  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const c of data as { composite_credit_days: number | null; final_composite_credit_days: number | null }[]) {
    const d = c.final_composite_credit_days ?? c.composite_credit_days;
    if (d === null || d === undefined) continue;
    const n = Number(d);
    if (Number.isNaN(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
    count += 1;
  }

  if (count === 0) return { minDays: null, maxDays: null, count: 0 };
  return { minDays: min, maxDays: max, count };
}

function rowToBand(r: Record<string, unknown>): PreapprovedBand {
  return {
    partyId: r.party_id as string,
    partyRole: r.party_role as PartyRole,
    policyVersionId: (r.policy_version_id as string) ?? null,
    policyMinDays: r.policy_min_days === null ? null : Number(r.policy_min_days),
    policyMaxDays: r.policy_max_days === null ? null : Number(r.policy_max_days),
    empiricalMinDays: r.empirical_min_days === null ? null : Number(r.empirical_min_days),
    empiricalMaxDays: r.empirical_max_days === null ? null : Number(r.empirical_max_days),
    stableParamCoveragePct: Number(r.stable_param_coverage_pct),
    closedCaseCount: Number(r.closed_case_count),
    sufficientHistory: Boolean(r.sufficient_history),
    computedAt: r.computed_at as string,
  };
}
