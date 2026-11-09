import { fetchScoreBands, fetchValidityRules, resolvePolicyVersionState } from '../actions';
import PolicyContextBar, { policyEditBlockedReason } from '../PolicyContextBar';
import ValidityClient from './ValidityClient';

export default async function ValidityPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const state = await resolvePolicyVersionState(v);
  const version = state.version;
  const [rules, bands] = version
    ? await Promise.all([fetchValidityRules(version.id), fetchScoreBands(version.id)])
    : [[], []];

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} requestedNotFound={state.requestedNotFound} draftCount={state.draftCount} latestDraft={state.latestDraft} />
      <ValidityClient
        rules={rules}
        scoreBands={bands}
        activePolicyId={version?.id}
        readOnlyReason={policyEditBlockedReason(version, state.requestedNotFound)}
      />
    </div>
  );
}
