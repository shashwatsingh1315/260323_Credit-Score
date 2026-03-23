import { fetchScoreBands } from '../actions';
import BandsClient from './BandsClient';

export default async function BandsPage() {
  const bands = await fetchScoreBands();
  return <BandsClient initialBands={bands as any[]} />;
}
