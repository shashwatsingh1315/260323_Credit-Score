import { fetchDominanceCategories, fetchActivePolicy } from '../actions';
import DominanceClient from './DominanceClient';

export default async function DominancePage() {
  const categories = await fetchDominanceCategories();
  const activePolicy = await fetchActivePolicy();

  return <DominanceClient categories={categories} activePolicyId={activePolicy?.id} />;
}
