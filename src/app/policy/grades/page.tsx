import { fetchGradeScales, resolvePolicyVersion } from '../actions';
import PolicyContextBar, { policyVersionQuery } from '../PolicyContextBar';
import GradesClient from './GradesClient';

export default async function GradesPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const version = await resolvePolicyVersion(v);
  const scales = await fetchGradeScales(version?.id);

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} />
      <GradesClient initialGrades={scales as any[]} policyVersionId={version?.id || null} backHref={`/policy${policyVersionQuery(version)}`} />
    </div>
  );
}
