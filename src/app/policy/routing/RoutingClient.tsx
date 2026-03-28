"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Edit } from 'lucide-react';
import { upsertRoutingRule, deleteRoutingRule } from '../actions';

export default function RoutingClient({ rules, activePolicyId }: { rules: any[]; activePolicyId?: string }) {
  const [editingRule, setEditingRule] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);

    // Construct the context_rule JSON from individual fields
    const exposureMin = fd.get('exposure_min');
    const scoreBelow = fd.get('score_below');

    const contextRule: any = {};
    if (exposureMin) contextRule.exposure_min = parseFloat(exposureMin as string);
    if (scoreBelow) contextRule.score_below = parseFloat(scoreBelow as string);

    fd.set('context_rule', JSON.stringify(contextRule));

    if (editingRule?.id) fd.set('id', editingRule.id);
    if (activePolicyId) fd.set('policy_version_id', activePolicyId);

    try {
      await upsertRoutingRule(fd);
      setEditingRule(null);
    } catch (err) {
      alert("Failed to save routing rule");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Routing Thresholds</h1>
          <p className="text-sm text-muted-foreground">Define rules to automatically route cases to deeper stages (Doc 06).</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingRule ? 'Edit Rule' : 'New Rule'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Minimum Exposure (₹)</Label>
                    <Input
                      name="exposure_min"
                      type="number"
                      defaultValue={editingRule?.context_rule?.exposure_min || ''}
                      placeholder="e.g. 1000000"
                    />
                    <p className="text-xs text-muted-foreground">Route if Requested Exposure is at least this amount.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Score Below</Label>
                    <Input
                      name="score_below"
                      type="number"
                      defaultValue={editingRule?.context_rule?.score_below || ''}
                      placeholder="e.g. 50"
                    />
                    <p className="text-xs text-muted-foreground">Route if initial score falls below this value.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Target Stage</Label>
                  <select name="target_stage" defaultValue={editingRule?.target_stage || 1} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                    <option value={1}>Stage 1</option>
                    <option value={2}>Stage 2</option>
                    <option value={3}>Stage 3</option>
                  </select>
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
                    <TableHead>Target Stage</TableHead>
                    <TableHead>Context Rule</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">Stage {r.target_stage}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {r.context_rule?.exposure_min && <div>Exposure &ge; ₹{r.context_rule.exposure_min.toLocaleString('en-IN')}</div>}
                          {r.context_rule?.score_below && <div>Score &lt; {r.context_rule.score_below}</div>}
                          {!r.context_rule?.exposure_min && !r.context_rule?.score_below && <div className="text-muted-foreground italic">No specific condition</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingRule(r)}>
                            <Edit size={14} />
                          </Button>
                          <form action={deleteRoutingRule}>
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
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No routing thresholds configured.</TableCell></TableRow>
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