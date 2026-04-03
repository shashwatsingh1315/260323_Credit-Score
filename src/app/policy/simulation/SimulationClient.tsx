"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { runSimulation } from './actions';

export default function SimulationClient({ parameters, grades, personas, dominance, bands, activePolicyId }: any) {
  const [result, setResult] = useState<any>(null);

  // Simulation state
  const [customerScore, setCustomerScore] = useState(75);
  const [contractorScore, setContractorScore] = useState(60);
  const [domId, setDomId] = useState(dominance[0]?.id || '');
  const [exposure, setExposure] = useState(5000000);

  const handleSimulate = async () => {
    // Basic local calculation for simulation purposes
    const dom = dominance.find((d: any) => d.id === domId);
    let finalScore = customerScore;

    if (dom) {
      if (dom.combination_method === 'customer_only') finalScore = customerScore;
      else if (dom.combination_method === 'contractor_only') finalScore = contractorScore;
      else if (dom.combination_method === 'power_law') {
        finalScore = Math.pow(Math.pow(customerScore, dom.customer_weight) * Math.pow(Math.max(contractorScore, 1), dom.contractor_weight), 1 / dom.exponent);
      } else {
        finalScore = (customerScore * dom.customer_weight) + (contractorScore * dom.contractor_weight);
      }
    }

    finalScore = Math.round(finalScore * 100) / 100;

    let approvedDays = 0;
    let bandName = 'Unknown';
    let isAmbiguous = false;

    const matchedBand = bands.find((b: any) => finalScore >= b.min_score && finalScore <= b.max_score);
    if (matchedBand) {
      approvedDays = matchedBand.approved_credit_days;
      bandName = matchedBand.band_name;
      isAmbiguous = matchedBand.is_ambiguity_band;
    }

    setResult({ finalScore, approvedDays, bandName, isAmbiguous });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Policy Simulation</h1>
          <p className="text-sm text-muted-foreground">Test score results and credit-day mapping before publishing policy (Doc 09).</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Simulation Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Simulated Customer Score (0-100)</Label>
              <Input type="number" value={customerScore} onChange={e => setCustomerScore(parseFloat(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label>Simulated Contractor Score (0-100)</Label>
              <Input type="number" value={contractorScore} onChange={e => setContractorScore(parseFloat(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label>Dominance Category</Label>
              <select value={domId} onChange={e => setDomId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                {dominance.map((d: any) => <option key={d.id} value={d.id}>{d.name} ({d.combination_method.replace('_', ' ')})</option>)}
              </select>
            </div>

            <Button onClick={handleSimulate} className="w-full">Run Simulation</Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="bg-brand/5 border-brand/20">
            <CardHeader>
              <CardTitle className="text-brand">Simulation Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-brand/80">Combined Final Score</Label>
                <p className="text-4xl font-bold text-brand">{result.finalScore}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-brand/80">Score Band</Label>
                  <p className="text-xl font-semibold">{result.bandName}</p>
                </div>
                <div>
                  <Label className="text-brand/80">Approved Credit Days</Label>
                  <p className="text-xl font-semibold text-success">{result.approvedDays} days</p>
                </div>
              </div>

              {result.isAmbiguous && (
                <div className="bg-warning/15 text-warning-foreground p-3 rounded text-sm font-medium border border-warning/20">
                  ⚠ This score falls within an ambiguity band.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}