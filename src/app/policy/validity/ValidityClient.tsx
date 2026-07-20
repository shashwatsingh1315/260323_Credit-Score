"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit } from 'lucide-react';
import { upsertValidityRule, deleteValidityRule } from '../actions';
import { SCENARIO_LABELS } from '@/lib/vocabulary';

export default function ValidityClient({ rules, scoreBands, activePolicyId }: { rules: any[]; scoreBands: any[]; activePolicyId?: string }) {
  const [editingRule, setEditingRule] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    if (editingRule?.id) fd.set('id', editingRule.id);
    if (activePolicyId) fd.set('policy_version_id', activePolicyId);

    try {
      const contextRule: Record<string, string> = {};
      const scoreBand = String(fd.get('score_band') || '');
      const scenario = String(fd.get('scenario') || '');
      if (scoreBand) contextRule.score_band = scoreBand;
      if (scenario) contextRule.scenario = scenario;
      fd.set('context_rule', JSON.stringify(contextRule));
      await upsertValidityRule(fd);
      setEditingRule(null);
    } catch (err) {
      alert("Failed to save validity rule");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Validity Rules</h1>
          <p className="text-sm text-muted-foreground">Stamp approval-validity windows using recognizable policy conditions.</p>
        </div>
      </div>

      {/* Truth-telling (doctrine §17): never present configuration as governing
          behavior it does not yet govern. */}
      <div className="rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning-strong">
        <strong>Warn mode.</strong> Matching rules stamp an expiry when approval completes and drive countdown or overdue warnings. Expiry never blocks negotiation or acceptance.
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingRule ? 'Edit Rule' : 'New Rule'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-2">
                  <Label>Score band (optional)</Label>
                  <select name="score_band" defaultValue={editingRule?.context_rule?.score_band || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Any score band</option>
                    {scoreBands.map((band) => <option key={band.id} value={band.band_name}>{band.band_name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Scenario (optional)</Label>
                  <select name="scenario" defaultValue={editingRule?.context_rule?.scenario || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Any scenario</option>
                    {Object.entries(SCENARIO_LABELS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Validity Window (Days)</Label>
                  <Input type="number" name="validity_days" defaultValue={editingRule?.validity_days || 90} required min={1} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="w-full">{editingRule ? 'Save Changes' : 'Create'}</Button>
                  {editingRule && <Button type="button" variant="outline" onClick={() => setEditingRule(null)}>Cancel</Button>}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Validity Days</TableHead>
                    <TableHead>Context Rule</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-success font-bold">{r.validity_days} days</TableCell>
                      <TableCell>
                        <span className="text-sm">{[
                          r.context_rule?.score_band ? `Band ${r.context_rule.score_band}` : null,
                          r.context_rule?.scenario ? SCENARIO_LABELS[r.context_rule.scenario]?.label : null,
                        ].filter(Boolean).join(' · ') || 'All approvals'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingRule(r)}>
                            <Edit size={14} />
                          </Button>
                          <form action={deleteValidityRule}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 size={14} />
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rules.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No validity rules configured.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
