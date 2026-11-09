import { fetchScoreBands, resolvePolicyVersionState } from '../actions';
import PolicyContextBar, { policyEditBlockedReason, policyVersionQuery } from '../PolicyContextBar';
import BandsClient from './BandsClient';

export default async function BandsPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const state = await resolvePolicyVersionState(v);
  const version = state.version;
  const bands = version ? await fetchScoreBands(version.id) : [];

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} requestedNotFound={state.requestedNotFound} draftCount={state.draftCount} latestDraft={state.latestDraft} />
      <BandsClient
        initialBands={bands as any[]}
        activePolicyId={version?.id || null}
        backHref={`/policy${policyVersionQuery(version)}`}
        readOnlyReason={policyEditBlockedReason(version, state.requestedNotFound)}
      />
    </div>
  );
}
