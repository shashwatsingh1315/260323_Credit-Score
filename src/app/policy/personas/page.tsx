import { fetchPersonas, resolvePolicyVersionState } from '../actions';
import PolicyContextBar, { policyEditBlockedReason, policyVersionQuery } from '../PolicyContextBar';
import PersonasClient from './PersonasClient';

export default async function PersonasPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const state = await resolvePolicyVersionState(v);
  const version = state.version;
  const personas = version ? await fetchPersonas(version.id) : [];

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} requestedNotFound={state.requestedNotFound} draftCount={state.draftCount} latestDraft={state.latestDraft} />
      <PersonasClient
        initialPersonas={personas as any[]}
        policyVersionId={version?.id || null}
        backHref={`/policy${policyVersionQuery(version)}`}
        readOnlyReason={policyEditBlockedReason(version, state.requestedNotFound)}
      />
    </div>
  );
}
