"use client";
import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit } from 'lucide-react';
import { upsertStageMaxTotal } from '../actions';
import { InlineError, ReadOnlyNotice, Receipt } from '../PolicyFeedback';
import type { ActionResult } from '../policy-parsing';

type StageMaxTotal = { id: string; stage: number; max_total: number | string };
type ImpliedTotal = { stage: number; value: number | string };

export default function StagesClient({ totals, impliedTotals, activePolicyId, readOnlyReason = null }: {
  totals: StageMaxTotal[];
  impliedTotals: ImpliedTotal[];
  activePolicyId?: string;
  readOnlyReason?: string | null;
}) {
  const [editingTotal, setEditingTotal] = useState<StageMaxTotal | null>(null);
  // Changing the key remounts the form, so its inputs take the defaults of the row now being edited.
  const [formKey, setFormKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const resetForm = () => {
    setEditingTotal(null);
    setFormKey((k) => k + 1);
  };
  const beginEdit = (total: StageMaxTotal) => {
    setEditingTotal(total);
    setFormError(null);
    setFormKey((k) => k + 1);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (editingTotal?.id) fd.set('id', editingTotal.id);
    if (activePolicyId) fd.set('policy_version_id', activePolicyId);
    setFormError(null);
    startSave(async () => {
      const result: ActionResult = await upsertStageMaxTotal(fd);
      if (result.ok) {
        setReceipt(result.message);
        resetForm();
      } else {
        setFormError(result.error);
      }
    });
  };

  const canEdit = readOnlyReason === null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Stage Max Totals</h1>
          <p className="text-sm text-muted-foreground">Define max totals for score normalization per stage (Stage 3 &gt; Stage 2 &gt; Stage 1).</p>
        </div>
      </div>

      <ReadOnlyNotice reason={readOnlyReason} />
      <Receipt message={receipt} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingTotal ? `Edit Stage ${editingTotal.stage} Total` : 'New Total'}</CardTitle>
            </CardHeader>
            <CardContent>
              {canEdit ? (
                <form key={`${editingTotal?.id ?? 'new'}-${formKey}`} onSubmit={submit} className="space-y-4">
                  <InlineError message={formError} />
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <select name="stage" defaultValue={String(editingTotal?.stage ?? 1)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                      <option value={1}>Stage 1</option>
                      <option value={2}>Stage 2</option>
                      <option value={3}>Stage 3</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Total</Label>
                    <Input type="number" step="0.01" min="0" name="max_total" defaultValue={editingTotal ? String(editingTotal.max_total) : '100'} required />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="w-full" disabled={isSaving}>{isSaving ? 'Saving…' : editingTotal ? 'Save Changes' : 'Create'}</Button>
                    {editingTotal && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">{readOnlyReason}</p>
              )}
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
                    {canEdit && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totals.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-brand font-bold">Stage {t.stage}</TableCell>
                      <TableCell>
                        <span>{t.max_total}</span>
                        {(() => {
                          const implied = Number(impliedTotals.find((item) => item.stage === t.stage)?.value || 0);
                          const configured = Number(t.max_total || 0);
                          const drift = configured > 0 ? Math.abs(implied - configured) / configured : implied > 0 ? 1 : 0;
                          return drift > 0.05 ? <p className="mt-1 text-xs text-warning-strong">Configured {configured}, but parameters can produce up to {implied} — scores will cap.</p> : <p className="mt-1 text-xs text-muted-foreground">Parameter capacity: {implied}</p>;
                        })()}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" aria-label={`Edit stage ${t.stage} total`} onClick={() => beginEdit(t)}>
                              <Edit size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {totals.length === 0 && (
                    <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center py-6 text-muted-foreground">No stage totals configured.</TableCell></TableRow>
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
