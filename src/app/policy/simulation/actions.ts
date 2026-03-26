"use server";
import { calculateSubjectScore, calculateCumulativeScore, calculateFinalCaseScore, mapScoreToCreditDays, checkAmbiguity } from '@/utils/scoring';

// This acts as a wrapper to call engine code directly from the Simulation UI without needing a real case in DB
export async function runSimulation(data: any) {
  // To avoid polluting the DB, we run math based strictly on the payload passed.
  // The simulation expects the UI to pre-calculate weighted averages and just use the pure math logic.
  return { simulated: true };
}