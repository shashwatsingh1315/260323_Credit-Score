import { fetchActivePolicy, fetchScoreBands } from '../actions';
import BandsClient from './BandsClient';

export default async function BandsPage() {
  const [bands, activePolicy] = await Promise.all([fetchScoreBands(), fetchActivePolicy()]);
  return <BandsClient initialBands={bands as any[]} activePolicyId={activePolicy?.id || null} />;
}
