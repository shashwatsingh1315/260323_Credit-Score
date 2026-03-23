import { fetchParameters } from '../actions';
import ParametersClient from './ParametersClient';

export default async function ParametersPage() {
  const params = await fetchParameters();
  return <ParametersClient initialParams={params as any[]} />;
}
