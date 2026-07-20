import { fetchScoreBands, resolvePolicyVersion } from '../actions';
import PolicyContextBar, { policyVersionQuery } from '../PolicyContextBar';
import BandsClient from './BandsClient';

export default async function BandsPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const version = await resolvePolicyVersion(v);
  const bands = await fetchScoreBands(version?.id);

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} />
      <BandsClient initialBands={bands as any[]} activePolicyId={version?.id || null} backHref={`/policy${policyVersionQuery(version)}`} />
    </div>
  );
}
