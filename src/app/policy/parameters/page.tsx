import { fetchParameters, resolvePolicyVersion } from '../actions';
import PolicyContextBar from '../PolicyContextBar';
import ParametersClient from './ParametersClient';

export default async function ParametersPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const version = await resolvePolicyVersion(v);
  const params = await fetchParameters(version?.id);

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} />
      <ParametersClient initialParams={params as any[]} activePolicy={version} />
    </div>
  );
}
