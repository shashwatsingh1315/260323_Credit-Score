import { fetchGradeScales, fetchParameters, fetchStageMaxTotals, resolvePolicyVersionState } from '../actions';
import PolicyContextBar, { policyEditBlockedReason } from '../PolicyContextBar';
import StagesClient from './StagesClient';

export default async function StagesPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const state = await resolvePolicyVersionState(v);
  const version = state.version;
  const [totals, parameters, grades] = version
    ? await Promise.all([
      fetchStageMaxTotals(version.id),
      fetchParameters(version.id),
      fetchGradeScales(version.id),
    ])
    : [[], [], []];
  const topGrade = Math.max(0, ...grades.map((grade: any) => Number(grade.grade_value) || 0));
  const impliedTotals = [1, 2, 3].map((stage) => ({
    stage,
    value: parameters
      .filter((parameter: any) => parameter.stage <= stage)
      .reduce((sum: number, parameter: any) => sum + Number(parameter.weight || 0) * topGrade, 0),
  }));

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} requestedNotFound={state.requestedNotFound} draftCount={state.draftCount} latestDraft={state.latestDraft} />
      <StagesClient
        totals={totals}
        impliedTotals={impliedTotals}
        activePolicyId={version?.id}
        readOnlyReason={policyEditBlockedReason(version, state.requestedNotFound)}
      />
    </div>
  );
}
