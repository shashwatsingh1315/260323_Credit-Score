"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Edit } from 'lucide-react';
import { upsertValidityRule, deleteValidityRule } from '../actions';

export default function ValidityClient({ rules, activePolicyId }: { rules: any[]; activePolicyId?: string }) {
  const [editingRule, setEditingRule] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    if (editingRule?.id) fd.set('id', editingRule.id);
    if (activePolicyId) fd.set('policy_version_id', activePolicyId);

    // Ensure valid JSON
    try {
      JSON.parse(fd.get('context_rule') as string);
      await upsertValidityRule(fd);
      setEditingRule(null);
    } catch (err) {
      alert("Invalid JSON in Context Rule");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Validity Rules</h1>
          <p className="text-sm text-muted-foreground">Define approval-validity windows (e.g. 90 days, 30 days) by context rule (Doc 09).</p>
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

                <div className="space-y-2">
                  <Label>Context Rule (JSON)</Label>
                  <Textarea name="context_rule" defaultValue={editingRule ? JSON.stringify(editingRule.context_rule, null, 2) : '{\n  "score_band": "Elite",\n  "scenario": "..."\n}'} rows={5} className="font-mono text-xs" required />
                  <p className="text-xs text-muted-foreground">JSON representing condition to trigger validity window.</p>
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
                        <pre className="text-xs bg-muted p-2 rounded">{JSON.stringify(r.context_rule)}</pre>
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