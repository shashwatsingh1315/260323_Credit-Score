import { fetchPersonas, resolvePolicyVersion } from '../actions';
import PolicyContextBar, { policyVersionQuery } from '../PolicyContextBar';
import PersonasClient from './PersonasClient';

export default async function PersonasPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const version = await resolvePolicyVersion(v);
  const personas = await fetchPersonas(version?.id);

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} />
      <PersonasClient initialPersonas={personas as any[]} policyVersionId={version?.id || null} backHref={`/policy${policyVersionQuery(version)}`} />
    </div>
  );
}
