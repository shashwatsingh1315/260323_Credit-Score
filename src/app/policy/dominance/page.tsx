import { fetchDominanceCategories, resolvePolicyVersion } from '../actions';
import PolicyContextBar from '../PolicyContextBar';
import DominanceClient from './DominanceClient';

export default async function DominancePage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const version = await resolvePolicyVersion(v);
  const categories = await fetchDominanceCategories(version?.id);

  return (
    <div className="space-y-4">
      <PolicyContextBar version={version} />
      <DominanceClient categories={categories} activePolicyId={version?.id} />
    </div>
  );
}
