import { fetchParameters, fetchActivePolicy } from '../actions';
import ParametersClient from './ParametersClient';

export default async function ParametersPage() {
  const [params, activePolicy] = await Promise.all([
    fetchParameters(),
    fetchActivePolicy()
  ]);

  return <ParametersClient initialParams={params as any[]} activePolicy={activePolicy} />;
}
