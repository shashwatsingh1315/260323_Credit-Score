import { fetchStageMaxTotals, fetchActivePolicy } from '../actions';
import StagesClient from './StagesClient';

export default async function StagesPage() {
  const totals = await fetchStageMaxTotals();
  const activePolicy = await fetchActivePolicy();

  return <StagesClient totals={totals} activePolicyId={activePolicy?.id} />;
}