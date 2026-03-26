"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit } from 'lucide-react';
import { upsertStageMaxTotal } from '../actions';

export default function StagesClient({ totals, activePolicyId }: { totals: any[]; activePolicyId?: string }) {
  const [editingTotal, setEditingTotal] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    if (editingTotal?.id) fd.set('id', editingTotal.id);
    if (activePolicyId) fd.set('policy_version_id', activePolicyId);

    await upsertStageMaxTotal(fd);
    setEditingTotal(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Stage Max Totals</h1>
          <p className="text-sm text-muted-foreground">Define max totals for score normalization per stage (Stage 3 &gt; Stage 2 &gt; Stage 1).</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingTotal ? 'Edit Total' : 'New Total'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-2">
                  <Label>Stage</Label>
                  <select name="stage" defaultValue={editingTotal?.stage || 1} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                    <option value={1}>Stage 1</option>
                    <option value={2}>Stage 2</option>
                    <option value={3}>Stage 3</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Max Total</Label>
                  <Input type="number" step="0.01" name="max_total" defaultValue={editingTotal?.max_total || 100} required />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="w-full">{editingTotal ? 'Save Changes' : 'Create'}</Button>
                  {editingTotal && <Button type="button" variant="outline" onClick={() => setEditingTotal(null)}>Cancel</Button>}
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
                    <TableHead>Stage</TableHead>
                    <TableHead>Max Total Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totals.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-indigo-600 font-bold">Stage {t.stage}</TableCell>
                      <TableCell>{t.max_total}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingTotal(t)}>
                            <Edit size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {totals.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No stage totals configured.</TableCell></TableRow>
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