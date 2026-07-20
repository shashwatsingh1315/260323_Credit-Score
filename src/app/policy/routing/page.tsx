import { fetchRoutingRules, resolvePolicyVersion } from '../actions';
import PolicyContextBar from '../PolicyContextBar';
import RoutingClient from './RoutingClient';

export default async function RoutingPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const version = await resolvePolicyVersion(v);
  const rules = await fetchRoutingRules(version?.id);

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} />
      <RoutingClient rules={rules} activePolicyId={version?.id} />
    </div>
  );
}
