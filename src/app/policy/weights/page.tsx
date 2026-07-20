import { fetchWeightMatrices, fetchPersonas, fetchParameters, resolvePolicyVersion } from '../actions';
import PolicyContextBar from '../PolicyContextBar';
import WeightsClient from './WeightsClient';

export default async function WeightsPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const version = await resolvePolicyVersion(v);
  const [matrices, personas, parameters] = await Promise.all([
    fetchWeightMatrices(version?.id),
    fetchPersonas(version?.id),
    fetchParameters(version?.id),
  ]);

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} />
      <WeightsClient matrices={matrices} personas={personas} parameters={parameters} />
    </div>
  );
}
