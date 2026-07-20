import { fetchScoreBands, fetchValidityRules, resolvePolicyVersion } from '../actions';
import PolicyContextBar from '../PolicyContextBar';
import ValidityClient from './ValidityClient';

export default async function ValidityPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const version = await resolvePolicyVersion(v);
  const [rules, bands] = await Promise.all([
    fetchValidityRules(version?.id),
    fetchScoreBands(version?.id),
  ]);

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} />
      <ValidityClient rules={rules} scoreBands={bands} activePolicyId={version?.id} />
    </div>
  );
}
