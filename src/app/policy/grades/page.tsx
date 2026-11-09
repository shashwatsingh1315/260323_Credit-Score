import { fetchGradeScales, resolvePolicyVersionState } from '../actions';
import PolicyContextBar, { policyEditBlockedReason, policyVersionQuery } from '../PolicyContextBar';
import GradesClient from './GradesClient';

export default async function GradesPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const state = await resolvePolicyVersionState(v);
  const version = state.version;
  const scales = version ? await fetchGradeScales(version.id) : [];

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} requestedNotFound={state.requestedNotFound} draftCount={state.draftCount} latestDraft={state.latestDraft} />
      <GradesClient
        initialGrades={scales as any[]}
        policyVersionId={version?.id || null}
        backHref={`/policy${policyVersionQuery(version)}`}
        readOnlyReason={policyEditBlockedReason(version, state.requestedNotFound)}
      />
    </div>
  );
}
