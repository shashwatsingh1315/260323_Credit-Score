"use client";
import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit } from 'lucide-react';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { upsertValidityRule, deleteValidityRule } from '../actions';
import { SCENARIO_LABELS } from '@/lib/vocabulary';
import { InlineError, ReadOnlyNotice, Receipt } from '../PolicyFeedback';
import type { ActionResult } from '../policy-parsing';

type ValidityRule = {
  id: string;
  validity_days: number;
  context_rule?: { score_band?: string; scenario?: string } | null;
};
type ScoreBand = { id: string; band_name: string };

export default function ValidityClient({ rules, scoreBands, activePolicyId, readOnlyReason = null }: {
  rules: ValidityRule[];
  scoreBands: ScoreBand[];
  activePolicyId?: string;
  readOnlyReason?: string | null;
}) {
  const [editingRule, setEditingRule] = useState<ValidityRule | null>(null);
  // Changing the key remounts the form, so its inputs take the defaults of the row now being edited.
  const [formKey, setFormKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<ValidityRule | null>(null);

  const resetForm = () => {
    setEditingRule(null);
    setFormKey((k) => k + 1);
  };
  const beginEdit = (rule: ValidityRule) => {
    setEditingRule(rule);
    setFormError(null);
    setFormKey((k) => k + 1);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (editingRule?.id) fd.set('id', editingRule.id);
    if (activePolicyId) fd.set('policy_version_id', activePolicyId);

    const contextRule: Record<string, string> = {};
    const scoreBand = String(fd.get('score_band') || '');
    const scenario = String(fd.get('scenario') || '');
    if (scoreBand) contextRule.score_band = scoreBand;
    if (scenario) contextRule.scenario = scenario;
    fd.set('context_rule', JSON.stringify(contextRule));

    setFormError(null);
    startSave(async () => {
      const result: ActionResult = await upsertValidityRule(fd);
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
    const result: ActionResult = await deleteValidityRule(formData);
    if (result.ok) setReceipt(result.message);
    else setTableError(result.error);
  };

  const canEdit = readOnlyReason === null;
  const ruleLabel = (rule: ValidityRule) => [
    rule.context_rule?.score_band ? `Band ${rule.context_rule.score_band}` : null,
    rule.context_rule?.scenario ? SCENARIO_LABELS[rule.context_rule.scenario]?.label ?? rule.context_rule.scenario : null,
  ].filter(Boolean).join(' · ') || 'All approvals';

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
                  <div className="space-y-2">
                    <Label>Score band (optional)</Label>
                    <select name="score_band" defaultValue={editingRule?.context_rule?.score_band ?? ''} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Any score band</option>
                      {scoreBands.map((band) => <option key={band.id} value={band.band_name}>{band.band_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Scenario (optional)</Label>
                    <select name="scenario" defaultValue={editingRule?.context_rule?.scenario ?? ''} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Any scenario</option>
                      {Object.entries(SCENARIO_LABELS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Validity Window (Days)</Label>
                    <Input type="number" name="validity_days" defaultValue={editingRule?.validity_days != null ? String(editingRule.validity_days) : '90'} required min={1} />
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
                    <TableHead>Validity Days</TableHead>
                    <TableHead>Context Rule</TableHead>
                    {canEdit && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-success font-bold">{r.validity_days} days</TableCell>
                      <TableCell>
                        <span className="text-sm">{ruleLabel(r)}</span>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" aria-label="Edit validity rule" onClick={() => beginEdit(r)}>
                              <Edit size={14} />
                            </Button>
                            <Button size="sm" variant="ghost" aria-label="Delete validity rule" type="button" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setPendingDelete(r)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {rules.length === 0 && (
                    <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center py-6 text-muted-foreground">No validity rules configured.</TableCell></TableRow>
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
          title="Remove this validity rule?"
          description="Approvals that match this rule will stop getting this expiry window."
          confirmLabel="Remove rule"
          tone="destructive"
          reasonLabel=""
          action={confirmDelete}
          hiddenFields={{ id: pendingDelete.id }}
          consequences={[
            `Approvals matching "${ruleLabel(pendingDelete)}" lose the ${pendingDelete.validity_days}-day window.`,
            'Approvals that already have an expiry keep it.',
          ]}
        />
      )}
    </div>
  );
}
