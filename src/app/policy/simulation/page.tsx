import { fetchParameters, fetchGradeScales, fetchPersonas, fetchDominanceCategories, fetchScoreBands, resolvePolicyVersionState } from '../actions';
import PolicyContextBar from '../PolicyContextBar';
import SimulationClient from './SimulationClient';

export default async function SimulationPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const state = await resolvePolicyVersionState(v);
  const version = state.version;
  const [parameters, grades, personas, dominance, bands] = version
    ? await Promise.all([
      fetchParameters(version.id),
      fetchGradeScales(version.id),
      fetchPersonas(version.id),
      fetchDominanceCategories(version.id),
      fetchScoreBands(version.id),
    ])
    : [[], [], [], [], []];

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} requestedNotFound={state.requestedNotFound} draftCount={state.draftCount} latestDraft={state.latestDraft} />
      <SimulationClient parameters={parameters} grades={grades} personas={personas} dominance={dominance} bands={bands} activePolicyId={version?.id} />
    </div>
  );
}
