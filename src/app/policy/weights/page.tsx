import { fetchWeightMatrices, fetchPersonas, fetchParameters, resolvePolicyVersionState } from '../actions';
import PolicyContextBar, { policyEditBlockedReason } from '../PolicyContextBar';
import WeightsClient from './WeightsClient';

export default async function WeightsPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const state = await resolvePolicyVersionState(v);
  const version = state.version;
  const [matrices, personas, parameters] = version
    ? await Promise.all([
      fetchWeightMatrices(version.id),
      fetchPersonas(version.id),
      fetchParameters(version.id),
    ])
    : [[], [], []];

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} requestedNotFound={state.requestedNotFound} draftCount={state.draftCount} latestDraft={state.latestDraft} />
      <WeightsClient
        matrices={matrices}
        personas={personas}
        parameters={parameters}
        readOnlyReason={policyEditBlockedReason(version, state.requestedNotFound)}
      />
    </div>
  );
}
