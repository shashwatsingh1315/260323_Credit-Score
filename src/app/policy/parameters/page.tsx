import { fetchParameters, resolvePolicyVersionState } from '../actions';
import PolicyContextBar, { policyEditBlockedReason } from '../PolicyContextBar';
import ParametersClient from './ParametersClient';

export default async function ParametersPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const state = await resolvePolicyVersionState(v);
  const version = state.version;
  const params = version ? await fetchParameters(version.id) : [];

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} requestedNotFound={state.requestedNotFound} draftCount={state.draftCount} latestDraft={state.latestDraft} />
      <ParametersClient
        initialParams={params as any[]}
        activePolicy={version}
        readOnlyReason={policyEditBlockedReason(version, state.requestedNotFound)}
      />
    </div>
  );
}
