import { fetchDominanceCategories, resolvePolicyVersionState } from '../actions';
import PolicyContextBar, { policyEditBlockedReason } from '../PolicyContextBar';
import DominanceClient from './DominanceClient';

export default async function DominancePage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const state = await resolvePolicyVersionState(v);
  const version = state.version;
  const categories = version ? await fetchDominanceCategories(version.id) : [];

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} requestedNotFound={state.requestedNotFound} draftCount={state.draftCount} latestDraft={state.latestDraft} />
      <DominanceClient
        categories={categories}
        activePolicyId={version?.id}
        readOnlyReason={policyEditBlockedReason(version, state.requestedNotFound)}
      />
    </div>
  );
}
