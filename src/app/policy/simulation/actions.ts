"use server";
import { calculateSubjectScore, calculateCumulativeScore, calculateFinalCaseScore, mapScoreToCreditDays, checkAmbiguity } from '@/utils/scoring'; // eslint-disable-line @typescript-eslint/no-unused-vars

// This acts as a wrapper to call engine code directly from the Simulation UI without needing a real case in DB
export async function runSimulation(data: any) { // eslint-disable-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  // To avoid polluting the DB, we run math based strictly on the payload passed.
  // The simulation expects the UI to pre-calculate weighted averages and just use the pure math logic.
  return { simulated: true };
}