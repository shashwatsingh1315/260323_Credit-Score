import { fetchWeightMatrices, fetchPersonas, fetchParameters } from '../actions';
import WeightsClient from './WeightsClient';

export default async function WeightsPage() {
  const matrices = await fetchWeightMatrices();
  const personas = await fetchPersonas();
  const parameters = await fetchParameters();

  return <WeightsClient matrices={matrices} personas={personas} parameters={parameters} />;
}