import { fetchParameters, fetchGradeScales, fetchPersonas, fetchDominanceCategories, fetchScoreBands, fetchActivePolicy } from '../actions';
import SimulationClient from './SimulationClient';

export default async function SimulationPage() {
  const parameters = await fetchParameters();
  const grades = await fetchGradeScales();
  const personas = await fetchPersonas();
  const dominance = await fetchDominanceCategories();
  const bands = await fetchScoreBands();
  const activePolicy = await fetchActivePolicy();

  return <SimulationClient parameters={parameters} grades={grades} personas={personas} dominance={dominance} bands={bands} activePolicyId={activePolicy?.id} />;
}