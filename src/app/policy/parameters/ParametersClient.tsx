"use client";
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { upsertParameter, deleteParameter } from '../actions';
import { Pencil, Trash2, Plus, ChevronLeft, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { policyStatusVariant, policyVersionQuery } from '../PolicyContextBar';
import { InlineError, ReadOnlyNotice, Receipt } from '../PolicyFeedback';
import { PERSISTENCE_LABELS, type ActionResult } from '../policy-parsing';

interface Parameter {
  id: string;
  name: string;
  subject_type: string;
  input_type: string;
  stage: number;
  default_owning_role: string;
  signal_strength: string;
  signal_cost: string;
  signal_lag: string;
  weight: number;
  sla_days?: number | null;
  require_reasoning?: boolean;
  is_critical?: boolean;
  is_stable?: boolean;
  persistence_scope?: string;
  rubric_guidance: string;
  auto_band_config?: any;
  is_active: boolean;
  policy_version_id: string;
}

export default function ParametersClient({ initialParams, activePolicy, readOnlyReason }: {
  initialParams: Parameter[];
  activePolicy: any;
  readOnlyReason: string | null;
}) {
  // Rows render straight from props so revalidated server data shows after save or delete.
  const params = initialParams;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parameter | null>(null);
  const [inputType, setInputType] = useState('grade_select');
  const [persistence, setPersistence] = useState('none');
  const [autoBandRules, setAutoBandRules] = useState<any[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Parameter, direction: 'asc' | 'desc' } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<Parameter | null>(null);

  const handleSort = (key: keyof Parameter) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filtered = params
    .filter(p => subjectFilter === 'all' || p.subject_type === subjectFilter)
    .filter(p => stageFilter === 'all' || p.stage.toString() === stageFilter)
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  const openNew = () => {
    setEditing(null);
    setInputType('grade_select');
    setPersistence('none');
    setAutoBandRules([]);
    setFormError(null);
    setOpen(true);
  };
  const openEdit = (p: Parameter) => {
    setEditing(p);
    // Handle legacy 'dropdown' value that was previously allowed in UI but rejected by DB
    const mappedType = p.input_type === 'dropdown' ? 'link_list' : (p.input_type || 'grade_select');
    setInputType(mappedType);
    setPersistence(p.persistence_scope ?? 'none');
    const existingRules = p.auto_band_config?.bands || p.auto_band_config?.mappings || [];
    setAutoBandRules(mappedType === 'yes_no'
      ? ['Yes', 'No'].map((value) => existingRules.find((rule: any) => String(rule.value).toLowerCase() === value.toLowerCase()) || { value, grade: value === 'Yes' ? 5 : 1 })
      : existingRules);
    setFormError(null);
    setOpen(true);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError(null);
    startSave(async () => {
      const result: ActionResult = await upsertParameter(formData);
      if (result.ok) {
        setReceipt(result.message);
        setOpen(false);
      } else {
        setFormError(result.error);
      }
    });
  };

  const confirmDelete = async (formData: FormData) => {
    setTableError(null);
    const result = await deleteParameter(formData);
    if (result.ok) setReceipt(result.message);
    else setTableError(result.error);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvData = event.target?.result as string;
      const lines = csvData.split('\n').filter(line => line.trim() !== '');
      const newRules = [];

      // Skip header row if it exists, roughly checking if first item is a number
      let startIdx = 0;
      if (lines.length > 0 && isNaN(Number(lines[0].split(',')[0]))) {
        startIdx = 1;
      }

      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim());
        if (inputType === 'numeric' && parts.length >= 3) {
          newRules.push({ min: Number(parts[0]), max: Number(parts[1]), grade: Number(parts[2]) });
        } else if ((inputType === 'short_text' || inputType === 'link_list') && parts.length >= 2) {
          newRules.push({ value: parts[0], grade: Number(parts[1]) });
        }
      }
      setAutoBandRules(newRules);
    };
    reader.readAsText(file);
  };

  const addRule = () => {
    if (inputType === 'yes_no') return;
    if (inputType === 'numeric') {
      setAutoBandRules([...autoBandRules, { min: 0, max: 0, grade: 1 }]);
    } else {
      setAutoBandRules([...autoBandRules, { value: '', grade: 1 }]);
    }
  };

  const removeRule = (idx: number) => {
    if (inputType === 'yes_no') return;
    setAutoBandRules(autoBandRules.filter((_, i) => i !== idx));
  };

  const updateRule = (idx: number, field: string, val: any) => {
    const updated = autoBandRules.map((rule, i) => (i === idx ? { ...rule, [field]: val } : rule));
    setAutoBandRules(updated);
  };

  const canEdit = readOnlyReason === null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/policy${policyVersionQuery(activePolicy)}`}><Button variant="ghost" size="sm"><ChevronLeft size={15} /> Back</Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Scoring Parameters</h1>
            {activePolicy && (
              <Badge variant={policyStatusVariant(activePolicy)} className="h-5">
                {activePolicy.version_label}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Define and weight parameters used in scoring assessments</p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={openNew}><Plus size={15} /> Add Parameter</Button>
        ) : (
          <Button size="sm" disabled title={readOnlyReason ?? undefined}><Plus size={15} /> Add Parameter</Button>
        )}
      </div>

      <ReadOnlyNotice reason={readOnlyReason} />
      <Receipt message={receipt} />
      <InlineError message={tableError} />

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground uppercase">Subject:</span>
          {['all', 'customer', 'contractor'].map(s => (
            <Button key={s} size="sm" variant={subjectFilter === s ? 'default' : 'outline'} onClick={() => setSubjectFilter(s)} className="capitalize h-8">
              {s}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground uppercase">Stage:</span>
          {['all', '1', '2', '3'].map(s => (
            <Button key={s} size="sm" variant={stageFilter === s ? 'default' : 'outline'} onClick={() => setStageFilter(s)} className="h-8">
              {s === 'all' ? 'All' : `Stage ${s}`}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1">Name <ArrowUpDown size={12} /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('stage')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1">Category <ArrowUpDown size={12} /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('subject_type')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1">Applies To <ArrowUpDown size={12} /></div>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead onClick={() => handleSort('weight')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1">Weight <ArrowUpDown size={12} /></div>
              </TableHead>
              <TableHead>Flags</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-8">No parameters yet.</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline">Stage {p.stage}</Badge></TableCell>
                <TableCell className="text-muted-foreground capitalize">{p.subject_type}</TableCell>
                <TableCell className="text-muted-foreground">{p.input_type}</TableCell>
                <TableCell className="tabular-nums">{p.weight}{p.weight === 0 && <span className="ml-1 text-tiny text-muted-foreground">excluded</span>}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant="secondary">{p.default_owning_role.toUpperCase()}</Badge>
                    {p.is_critical && (
                      <Badge variant="warning" title="Missing evidence makes a case ambiguous">Critical</Badge>
                    )}
                    {p.is_stable && (
                      <Badge
                        variant="outline"
                        className="border-info text-info-strong bg-info/10"
                        title="Stable parameter — feeds the preapproved credit-days band"
                      >
                        S
                      </Badge>
                    )}
                    {p.persistence_scope && p.persistence_scope !== 'none' && (
                      <Badge
                        variant="info"
                        title={`Remembered: ${PERSISTENCE_LABELS[p.persistence_scope] ?? p.persistence_scope}`}
                      >
                        R
                      </Badge>
                    )}
                  </div>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}><Pencil size={15} /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} type="button" className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(p)}><Trash2 size={15} /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(next) => { if (!next) setPendingDelete(null); }}
          title={`Remove "${pendingDelete.name}"?`}
          description={`It is archived in ${activePolicy?.version_label ?? 'this version'}. Drafts keep their own copy.`}
          confirmLabel="Remove parameter"
          tone="destructive"
          reasonLabel=""
          action={confirmDelete}
          hiddenFields={{ id: pendingDelete.id }}
          consequences={[
            `Stage ${pendingDelete.stage} loses this parameter (weight ${pendingDelete.weight}) when scoring runs.`,
            'Scoring capacity for the stage drops, so the stage max total may need review.',
          ]}
        />
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Parameter' : 'New Parameter'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="policy_version_id" value={activePolicy?.id ?? ''} />
            <input type="hidden" name="persistence_scope" value={persistence} />
            <InlineError message={formError} />
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="col-span-2 space-y-1">
                <Label>Parameter Name</Label>
                <Input name="parameter_name" defaultValue={editing?.name ?? ''} required />
              </div>
              <div className="space-y-1">
                <Label>Subject Type</Label>
                <select name="applies_to_subject" defaultValue={editing?.subject_type ?? 'customer'} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="customer">Customer</option>
                  <option value="contractor">Contractor</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Stage (1-3)</Label>
                <Input name="stage" type="number" min="1" max="3" defaultValue={editing?.stage ?? 1} required />
              </div>
              <div className="space-y-1">
                <Label>Owning Role</Label>
                <select name="default_owning_role" defaultValue={editing?.default_owning_role ?? 'rm'} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="rm">RM</option>
                  <option value="kam">KAM</option>
                  <option value="bdo">BDO</option>
                  <option value="accounts">ACCOUNTS</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Input Type</Label>
                <select
                  name="data_type"
                  value={inputType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setInputType(nextType);
                    setAutoBandRules(nextType === 'yes_no'
                      ? [{ value: 'Yes', grade: 5 }, { value: 'No', grade: 1 }]
                      : []);
                  }}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="grade_select">Manual Grade (1-5)</option>
                  <option value="numeric">Numeric (Auto-Mapped)</option>
                  <option value="link_list">Dropdown Select (Auto-Mapped)</option>
                  <option value="yes_no">Yes/No (Auto-Mapped)</option>
                  <option value="short_text">Short Text</option>
                  <option value="long_text">Long Text</option>
                  <option value="date">Date</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Weight</Label>
                <Input name="weight" type="number" step="0.01" min="0" max="100" defaultValue={editing ? String(editing.weight) : '1'} required />
                <p className="text-tiny text-muted-foreground">0 excludes this parameter from scoring.</p>
              </div>
              <div className="col-span-2 flex items-start gap-2 rounded-md border border-warning/25 bg-warning/10 p-3">
                <input type="checkbox" name="is_critical" id="is_critical" value="true" defaultChecked={editing?.is_critical ?? false} className="mt-0.5 h-4 w-4 rounded border-input" />
                <div>
                  <Label htmlFor="is_critical">Critical evidence</Label>
                  <p className="text-tiny text-muted-foreground">If unanswered when scoring runs, the case is flagged ambiguous and routed to board review.</p>
                </div>
              </div>
              <div className="col-span-2 space-y-1 rounded-md border border-border p-3">
                <Label htmlFor="persistence_select">Remember answer</Label>
                <select
                  id="persistence_select"
                  value={persistence}
                  onChange={(e) => setPersistence(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="none">{PERSISTENCE_LABELS.none}</option>
                  <option value="party">{PERSISTENCE_LABELS.party}</option>
                  {/* Rows saved with site or RM keep that value so saving does not wipe it; intake does not reuse it yet. */}
                  {persistence !== 'none' && persistence !== 'party' && (
                    <option value={persistence}>{`${PERSISTENCE_LABELS[persistence] ?? persistence} (not yet used at intake)`}</option>
                  )}
                </select>
                <p className="text-tiny text-muted-foreground">
                  Saved answers are reused at case intake for the same party. Per case only keeps the answer to one case.
                </p>
              </div>
              <details className="col-span-2 rounded-md border border-border p-3">
                <summary className="cursor-pointer text-xs font-semibold">Signal metadata — reserved for Phase 2 (not yet used in scoring)</summary>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Lag Type</Label>
                    <select name="signal_lag" defaultValue={editing?.signal_lag ?? 'Leading'} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm">
                      <option value="Leading">Leading</option><option value="Lagging">Lagging</option>
                    </select>
                  </div>
                  <div className="space-y-1"><Label>Strength (1-5)</Label><Input name="signal_strength" type="number" min="1" max="5" defaultValue={editing?.signal_strength ?? '3'} /></div>
                  <div className="space-y-1"><Label>Cost (1-5)</Label><Input name="signal_cost" type="number" min="1" max="5" defaultValue={editing?.signal_cost ?? '3'} /></div>
                </div>
              </details>
              <div className="space-y-1">
                <Label>SLA Days</Label>
                <Input name="sla_days" type="number" min="0" max="30" defaultValue={editing?.sla_days ?? ''} placeholder="Leave empty for no SLA" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" name="require_reasoning" id="require_reasoning" value="true" defaultChecked={editing?.require_reasoning ?? false} className="w-4 h-4 rounded border-input" />
                <Label htmlFor="require_reasoning">Require Mandatory Reasoning</Label>
              </div>
              <div className="col-span-2 flex items-start gap-2 p-3 border rounded-md bg-info/5">
                <input
                  type="checkbox"
                  name="is_stable"
                  id="is_stable"
                  value="true"
                  defaultChecked={editing?.is_stable ?? false}
                  className="w-4 h-4 rounded border-input mt-0.5"
                />
                <div>
                  <Label htmlFor="is_stable" className="font-medium">Stable parameter</Label>
                  <p className="text-tiny text-muted-foreground">
                    Mark when this parameter reflects party-level history (e.g. repayment track record).
                    Stable parameters are sourced from party history / cached answers and feed the
                    preapproved credit-days band shown before scoring runs.
                  </p>
                </div>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Rubric Guidance (Description & Ratings)</Label>
                <Textarea name="description" defaultValue={editing?.rubric_guidance ?? ''} rows={4} className="text-xs" />
              </div>

              {(inputType === 'numeric' || inputType === 'link_list' || inputType === 'yes_no') && (
                <div className="col-span-2 space-y-3 p-4 border rounded-md bg-muted/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label>Auto-Mapping / Banding Rules</Label>
                      <p className="text-tiny text-muted-foreground">Map raw values to a 1-5 grade.</p>
                    </div>
                    <div className="flex gap-2">
                      {inputType !== 'yes_no' && <Label className="cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80 h-7 px-3 flex items-center justify-center rounded-md text-xs">
                        Upload CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                      </Label>}
                      {inputType !== 'yes_no' && <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addRule}>
                        <Plus size={12} className="mr-1" /> Add Rule
                      </Button>}
                    </div>
                  </div>

                  <input
                    type="hidden"
                    name="auto_band_config"
                    value={autoBandRules.length > 0 ? JSON.stringify(inputType === 'numeric' ? { bands: autoBandRules } : { mappings: autoBandRules }) : ''}
                  />

                  {autoBandRules.length > 0 ? (
                    <div className="space-y-2">
                      {autoBandRules.map((rule, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          {inputType === 'numeric' ? (
                            <>
                              <Input
                                type="number"
                                value={rule.min}
                                onChange={(e) => updateRule(idx, 'min', Number(e.target.value))}
                                className="h-8"
                                placeholder="Min"
                              />
                              <span className="text-xs">to</span>
                              <Input
                                type="number"
                                value={rule.max}
                                onChange={(e) => updateRule(idx, 'max', Number(e.target.value))}
                                className="h-8"
                                placeholder="Max"
                              />
                            </>
                          ) : (
                            <Input
                              type="text"
                              value={rule.value}
                              onChange={(e) => inputType !== 'yes_no' && updateRule(idx, 'value', e.target.value)}
                              readOnly={inputType === 'yes_no'}
                              className="h-8"
                              placeholder={inputType === 'yes_no' ? 'Yes or No' : 'Exact Value'}
                            />
                          )}
                          <span className="text-xs">→ Grade:</span>
                          <select
                            value={rule.grade}
                            onChange={(e) => updateRule(idx, 'grade', Number(e.target.value))}
                            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                          >
                            {[1, 2, 3, 4, 5].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          {inputType !== 'yes_no' && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(idx)}>
                            <Trash2 size={14} />
                          </Button>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-2">No rules defined. Parameter will be purely informational if not mapped.</p>
                  )}
                </div>
              )}

            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
