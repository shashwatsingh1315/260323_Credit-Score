"use client";
import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit } from 'lucide-react';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { upsertDominanceCategory, deleteDominanceCategory, fetchDominanceCategoryUsage } from '../actions';
import { InlineError, ReadOnlyNotice, Receipt } from '../PolicyFeedback';
import { errorMessage, type ActionResult } from '../policy-parsing';

type DominanceCategory = {
  id: string;
  name: string;
  combination_method: string;
  customer_weight: number | null;
  contractor_weight: number | null;
  exponent: number | null;
};

interface DominanceClientProps {
  categories: DominanceCategory[];
  activePolicyId?: string;
  readOnlyReason?: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  weighted: 'Weighted blend',
  power_law: 'Power law',
  customer_only: 'Customer only',
  contractor_only: 'Contractor only',
};

export default function DominanceClient({ categories, activePolicyId, readOnlyReason = null }: DominanceClientProps) {
  const [editingCat, setEditingCat] = useState<DominanceCategory | null>(null);
  const [method, setMethod] = useState('weighted');
  // Changing the key remounts the form, so its inputs take the defaults of the row now being edited.
  const [formKey, setFormKey] = useState(0);
  const [customerInput, setCustomerInput] = useState('0.5');
  const [contractorInput, setContractorInput] = useState('0.5');
  const [formError, setFormError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<(DominanceCategory & { usage: number }) | null>(null);

  const resetForm = () => {
    setEditingCat(null);
    setMethod('weighted');
    setCustomerInput('0.5');
    setContractorInput('0.5');
    setFormKey((k) => k + 1);
  };

  const beginEdit = (c: DominanceCategory) => {
    setEditingCat(c);
    setMethod(c.combination_method);
    setCustomerInput(String(c.customer_weight ?? 0.5));
    setContractorInput(String(c.contractor_weight ?? 0.5));
    setFormError(null);
    setFormKey((k) => k + 1);
  };

  const weightSum = Number(customerInput) + Number(contractorInput);
  const blendValid = Number.isFinite(weightSum) && Math.abs(weightSum - 1) <= 0.005;
  const blendApplies = method === 'weighted';

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (editingCat?.id) fd.set('id', editingCat.id);
    if (activePolicyId) fd.set('policy_version_id', activePolicyId);
    setFormError(null);
    startSave(async () => {
      const result: ActionResult = await upsertDominanceCategory(fd);
      if (result.ok) {
        setReceipt(result.message);
        resetForm();
      } else {
        setFormError(result.error);
      }
    });
  };

  const confirmDelete = async (formData: FormData) => {
    setTableError(null);
    const result: ActionResult = await deleteDominanceCategory(formData);
    if (result.ok) setReceipt(result.message);
    else setTableError(result.error);
  };

  // Look up how many review cycles use the category before the confirm opens.
  const openDelete = async (c: DominanceCategory) => {
    setTableError(null);
    try {
      const usage = await fetchDominanceCategoryUsage(c.id);
      setPendingDelete({ ...c, usage });
    } catch (err) {
      setTableError(errorMessage(err));
    }
  };

  const canEdit = readOnlyReason === null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Dominance Categories</h1>
          <p className="text-sm text-muted-foreground">Manage how customer and contractor scores are combined.</p>
        </div>
      </div>

      <ReadOnlyNotice reason={readOnlyReason} />
      <Receipt message={receipt} />
      <InlineError message={tableError} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingCat ? `Edit "${editingCat.name}"` : 'New Category'}</CardTitle>
            </CardHeader>
            <CardContent>
              {canEdit ? (
                <form key={`${editingCat?.id ?? 'new'}-${formKey}`} onSubmit={submit} className="space-y-4">
                  <InlineError message={formError} />
                  <div className="space-y-2">
                    <Label>Category Name</Label>
                    <Input name="name" defaultValue={editingCat?.name ?? ''} required />
                  </div>

                  <div className="space-y-2">
                    <Label>Combination Method</Label>
                    <select name="combination_method" value={method} onChange={(event) => setMethod(event.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="weighted">Weighted Blend</option>
                      <option value="power_law">Power Law</option>
                      <option value="customer_only">Customer Only</option>
                      <option value="contractor_only">Contractor Only</option>
                    </select>
                  </div>

                  {(method === 'weighted' || method === 'power_law') ? <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Customer Wgt</Label>
                      <Input name="customer_weight" type="number" step="0.01" min="0" value={customerInput} onChange={(e) => setCustomerInput(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Contractor Wgt</Label>
                      <Input name="contractor_weight" type="number" step="0.01" min="0" value={contractorInput} onChange={(e) => setContractorInput(e.target.value)} required />
                    </div>
                  </div> : <p className="rounded-md border border-info/25 bg-info/10 p-3 text-xs text-info-strong">{method === 'customer_only' ? 'The final case score equals the customer score.' : 'The final case score equals the contractor score.'}</p>}

                  {blendApplies && (
                    <p role="status" className={`text-xs ${blendValid ? 'text-muted-foreground' : 'text-warning-strong'}`}>
                      {Number.isFinite(weightSum)
                        ? `Customer ${customerInput || 0} + Contractor ${contractorInput || 0} = ${weightSum.toFixed(2)}${blendValid ? '' : ' — must equal 1.00 to save'}`
                        : 'Enter both weights. They must add up to 1.00.'}
                    </p>
                  )}

                  {method === 'power_law' && <div className="space-y-2">
                    <Label>Exponent (Power Law)</Label>
                    <Input name="exponent" type="number" step="0.01" min="0" defaultValue={editingCat?.exponent != null ? String(editingCat.exponent) : '1'} />
                  </div>}

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="w-full" disabled={isSaving || (blendApplies && !blendValid)}>
                      {isSaving ? 'Saving…' : editingCat ? 'Save Changes' : 'Create'}
                    </Button>
                    {editingCat && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Cust Wgt</TableHead>
                    <TableHead>Cont Wgt</TableHead>
                    <TableHead>Exponent</TableHead>
                    {canEdit && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id} className={editingCat?.id === c.id ? 'bg-primary/5' : undefined}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{METHOD_LABELS[c.combination_method] ?? c.combination_method}</TableCell>
                      <TableCell className="tabular-nums">{c.customer_weight}</TableCell>
                      <TableCell className="tabular-nums">{c.contractor_weight}</TableCell>
                      <TableCell className="tabular-nums">{c.combination_method === 'power_law' ? c.exponent : '—'}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => beginEdit(c)}>
                              <Edit size={14} />
                            </Button>
                            <Button size="sm" variant="ghost" aria-label={`Delete ${c.name}`} type="button" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDelete(c)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center py-6 text-muted-foreground">No dominance categories configured.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {pendingDelete && pendingDelete.usage > 0 && (
        <Dialog open onOpenChange={(next) => { if (!next) setPendingDelete(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{`"${pendingDelete.name}" cannot be removed`}</DialogTitle>
              <DialogDescription>
                {`Used by ${pendingDelete.usage} review cycle${pendingDelete.usage === 1 ? '' : 's'} — cannot be removed. Existing cycles keep the category they were scored with.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {pendingDelete && pendingDelete.usage === 0 && (
        <ConfirmDialog
          open
          onOpenChange={(next) => { if (!next) setPendingDelete(null); }}
          title={`Remove "${pendingDelete.name}"?`}
          description="The category is removed from this policy version."
          confirmLabel="Remove category"
          tone="destructive"
          reasonLabel=""
          action={confirmDelete}
          hiddenFields={{ id: pendingDelete.id }}
          consequences={[
            `Used by 0 review cycles.`,
            `${METHOD_LABELS[pendingDelete.combination_method] ?? pendingDelete.combination_method} (customer ${pendingDelete.customer_weight}, contractor ${pendingDelete.contractor_weight}) stops being available.`,
            'Scores combined with this category will no longer use these weights once the version is in effect.',
          ]}
        />
      )}
    </div>
  );
}
