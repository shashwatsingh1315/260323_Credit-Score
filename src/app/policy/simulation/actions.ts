"use server";
import { calculateSubjectScore, calculateCumulativeScore, calculateFinalCaseScore, mapScoreToCreditDays, checkAmbiguity } from '@/utils/scoring';

// This acts as a wrapper to call engine code directly from the Simulation UI without needing a real case in DB

export async function runSimulation(data: any) {
  // data should contain { policyVersionId, cycleScores: { customer: [...], contractor: [...] } }
  // Since this is a simulation without DB records, we will use the exported pure engine math

  if (!data.policyVersionId) return { error: 'No policy version selected' };

  let customerWeightedSum = 0;
  let contractorWeightedSum = 0;

  // Assuming data structure from UI: { customer: [{grade, weight}], contractor: [{grade, weight}] }
  if (data.customer) {
    customerWeightedSum = data.customer.reduce((sum: number, p: any) => sum + (Number(p.grade) * Number(p.weight)), 0);
  }
  if (data.contractor) {
    contractorWeightedSum = data.contractor.reduce((sum: number, p: any) => sum + (Number(p.grade) * Number(p.weight)), 0);
  }

  const customerMaxTotal = data.customerMaxTotal || 100;
  const contractorMaxTotal = data.contractorMaxTotal || 100;

  const customerScore = customerMaxTotal > 0 ? (customerWeightedSum / customerMaxTotal) * 100 : 0;
  const contractorScore = contractorMaxTotal > 0 ? (contractorWeightedSum / contractorMaxTotal) * 100 : 0;

  let finalScore = 0;
  const method = data.combinationMethod || 'weighted';
  if (method === 'customer_only') finalScore = customerScore;
  else if (method === 'contractor_only') finalScore = contractorScore;
  else if (method === 'power_law') {
    const exp = Number(data.exponent) > 0 ? Number(data.exponent) : 1;
    finalScore = Math.pow(
      Math.pow(customerScore, Number(data.customerWeight)) * Math.pow(Math.max(contractorScore, 0), Number(data.contractorWeight)),
      1 / exp
    );
  } else {
    finalScore = (customerScore * Number(data.customerWeight || 0.5)) + (contractorScore * Number(data.contractorWeight || 0.5));
  }

  const roundedScore = Math.round(finalScore * 100) / 100;

  // Find band
  const bandResult = await mapScoreToCreditDays({ policyVersionId: data.policyVersionId, score: roundedScore });

  return {
    simulated: true,
    customerScore: Math.round(customerScore),
    contractorScore: Math.round(contractorScore),
    finalScore: roundedScore,
    bandName: bandResult?.bandName || 'No matching band',
    approvedDays: bandResult?.approvedDays || 0,
    isAmbiguous: bandResult?.isAmbiguity || false
  };
}