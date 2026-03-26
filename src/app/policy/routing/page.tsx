import { fetchRoutingRules, fetchActivePolicy } from '../actions';
import RoutingClient from './RoutingClient';

export default async function RoutingPage() {
  const rules = await fetchRoutingRules();
  const activePolicy = await fetchActivePolicy();

  return <RoutingClient rules={rules} activePolicyId={activePolicy?.id} />;
}