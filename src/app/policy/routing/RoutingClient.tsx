"use client";
import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit } from 'lucide-react';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { upsertRoutingRule, deleteRoutingRule } from '../actions';
import { SCENARIO_LABELS } from '@/lib/vocabulary';
import { InlineError, ReadOnlyNotice, Receipt } from '../PolicyFeedback';
import type { ActionResult } from '../policy-parsing';

type RoutingRule = {
  id: string;
  target_stage: number;
  context_rule?: { exposure_min?: number; score_below?: number; scenario?: string } | null;
};

export default function RoutingClient({ rules, activePolicyId, readOnlyReason = null }: {
  rules: RoutingRule[];
  activePolicyId?: string;
  readOnlyReason?: string | null;
}) {
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  // Changing the key remounts the form, so its inputs take the defaults of the row now being edited.
  const [formKey, setFormKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<RoutingRule | null>(null);

  const resetForm = () => {
    setEditingRule(null);
    setFormKey((k) => k + 1);
  };
  const beginEdit = (rule: RoutingRule) => {
    setEditingRule(rule);
    setFormError(null);
    setFormKey((k) => k + 1);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Construct the context_rule JSON from individual fields. Only conditions the admin filled in are kept.
    const exposureMin = String(fd.get('exposure_min') ?? '').trim();
    const scoreBelow = String(fd.get('score_below') ?? '').trim();
    const scenario = String(fd.get('scenario') ?? '');

    const contextRule: Record<string, number | string> = {};
    if (exposureMin !== '' && Number.isFinite(Number(exposureMin))) contextRule.exposure_min = Number(exposureMin);
    if (scoreBelow !== '' && Number.isFinite(Number(scoreBelow))) contextRule.score_below = Number(scoreBelow);
    if (scenario) contextRule.scenario = scenario;

    fd.set('context_rule', JSON.stringify(contextRule));
    if (editingRule?.id) fd.set('id', editingRule.id);
    if (activePolicyId) fd.set('policy_version_id', activePolicyId);

    setFormError(null);
    startSave(async () => {
      const result: ActionResult = await upsertRoutingRule(fd);
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
    const result: ActionResult = await deleteRoutingRule(formData);
    if (result.ok) setReceipt(result.message);
    else setTableError(result.error);
  };

  const canEdit = readOnlyReason === null;
  const ruleSummary = (rule: RoutingRule) => [
    rule.context_rule?.exposure_min != null ? `exposure ≥ ₹${Number(rule.context_rule.exposure_min).toLocaleString('en-IN')}` : null,
    rule.context_rule?.scenario ? `scenario is ${SCENARIO_LABELS[rule.context_rule.scenario]?.label ?? rule.context_rule.scenario}` : null,
    rule.context_rule?.score_below != null ? `score < ${rule.context_rule.score_below}` : null,
  ].filter(Boolean).join(' and ') || 'the case is submitted';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Routing Thresholds</h1>
          <p className="text-sm text-muted-foreground">Define rules to automatically route cases to deeper stages (Doc 06).</p>
        </div>
      </div>

      <div className="rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success-strong">
        Routing is enforced at submission. Matching rules deepen the required review stage; score rules can deepen it again after scoring, but never make it shallower mid-cycle.
      </div>

      <ReadOnlyNotice reason={readOnlyReason} />
      <Receipt message={receipt} />
      <InlineError message={tableError} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingRule ? 'Edit Rule' : 'New Rule'}</CardTitle>
            </CardHeader>
            <CardContent>
              {canEdit ? (
                <form key={`${editingRule?.id ?? 'new'}-${formKey}`} onSubmit={submit} className="space-y-4">
                  <InlineError message={formError} />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Minimum Exposure (₹)</Label>
                      <Input
                        name="exposure_min"
                        type="number"
                        defaultValue={editingRule?.context_rule?.exposure_min != null ? String(editingRule.context_rule.exposure_min) : ''}
                        placeholder="e.g. 1000000"
                      />
                      <p className="text-xs text-muted-foreground">Route if Requested Exposure is at least this amount.</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Scenario</Label>
                      <select name="scenario" defaultValue={editingRule?.context_rule?.scenario ?? ''} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">Any scenario</option>
                        {Object.entries(SCENARIO_LABELS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Score Below</Label>
                      <Input
                        name="score_below"
                        type="number"
                        defaultValue={editingRule?.context_rule?.score_below != null ? String(editingRule.context_rule.score_below) : ''}
                        placeholder="e.g. 50"
                      />
                      <p className="text-xs text-muted-foreground">Route if initial score falls below this value.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Target Stage</Label>
                    <select name="target_stage" defaultValue={String(editingRule?.target_stage ?? 1)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                      <option value={1}>Stage 1</option>
                      <option value={2}>Stage 2</option>
                      <option value={3}>Stage 3</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="w-full" disabled={isSaving}>{isSaving ? 'Saving…' : editingRule ? 'Save Changes' : 'Create'}</Button>
                    {editingRule && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
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
                    <TableHead>Target Stage</TableHead>
                    <TableHead>Context Rule</TableHead>
                    {canEdit && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">Stage {r.target_stage}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <div>If {ruleSummary(r)} → must reach Stage {r.target_stage}</div>
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" aria-label="Edit routing rule" onClick={() => beginEdit(r)}>
                              <Edit size={14} />
                            </Button>
                            <Button size="sm" variant="ghost" aria-label="Delete routing rule" type="button" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setPendingDelete(r)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {rules.length === 0 && (
                    <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center py-6 text-muted-foreground">No routing thresholds configured.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(next) => { if (!next) setPendingDelete(null); }}
          title="Remove this routing rule?"
          description="Cases that match this rule will no longer be routed to a deeper stage."
          confirmLabel="Remove rule"
          tone="destructive"
          reasonLabel=""
          action={confirmDelete}
          hiddenFields={{ id: pendingDelete.id }}
          consequences={[
            `Cases that match "${ruleSummary(pendingDelete)}" stop being sent to Stage ${pendingDelete.target_stage}.`,
            'Open review cycles that use the live policy are affected immediately.',
          ]}
        />
      )}
    </div>
  );
}
