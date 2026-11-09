"use client";
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { upsertScoreBand, deleteScoreBand } from '../actions';
import { Pencil, Trash2, Plus, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { InlineError, ReadOnlyNotice, Receipt } from '../PolicyFeedback';
import type { ActionResult } from '../policy-parsing';

interface ScoreBand {
  id: string; band_name: string; min_score: number; max_score: number;
  approved_credit_days: number;
  is_ambiguity_band: boolean;
}

/* Bands are colored by position, cycling through the severity tokens.
   Alpha must go inside hsl() — string-concatenating hex alpha onto an
   hsl(var()) expression produces invalid CSS. */
const bandHues = [
  '--color-success',
  '--color-info',
  '--color-warning',
  '--color-destructive',
  '--color-brand',
  '--color-attention',
];
const bandColor = (i: number) => `hsl(var(${bandHues[i % bandHues.length]}))`;
const bandTint = (i: number) => `hsl(var(${bandHues[i % bandHues.length]}) / 0.35)`;

export default function BandsClient({ initialBands, activePolicyId, backHref = '/policy', readOnlyReason = null }: {
  initialBands: ScoreBand[];
  activePolicyId: string | null;
  backHref?: string;
  readOnlyReason?: string | null;
}) {
  // Render from props so revalidated server data shows after save or delete.
  const bands = initialBands;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ScoreBand | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<ScoreBand | null>(null);

  const openDialog = (band: ScoreBand | null) => {
    setEditing(band);
    setFormError(null);
    setOpen(true);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError(null);
    startSave(async () => {
      const result: ActionResult = await upsertScoreBand(formData);
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
    const result = await deleteScoreBand(formData);
    if (result.ok) setReceipt(result.message);
    else setTableError(result.error);
  };

  const canEdit = readOnlyReason === null;

  // Build visual band chart
  const sorted = [...bands].sort((a, b) => b.min_score - a.min_score);
  const maxDays = Math.max(...bands.map(b => b.approved_credit_days), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}><Button variant="ghost" size="sm"><ChevronLeft size={15} /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Score Bands</h1>
          <p className="text-sm text-muted-foreground">Map score ranges to approved credit day buckets</p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => openDialog(null)}><Plus size={15} /> Add Band</Button>
        ) : (
          <Button size="sm" disabled title={readOnlyReason ?? undefined}><Plus size={15} /> Add Band</Button>
        )}
      </div>

      <ReadOnlyNotice reason={readOnlyReason} />
      <Receipt message={receipt} />
      <InlineError message={tableError} />

      {/* Visual mapper */}
      {bands.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Score → Credit Days Visual Map</p>
          <div className="space-y-2">
            {sorted.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground w-20 shrink-0 text-right">{b.min_score}–{b.max_score}</div>
                <div className="flex-1 relative h-7 rounded overflow-hidden bg-muted">
                  <div
                    className="h-full rounded flex items-center pl-2.5"
                    style={{ width: `${(b.approved_credit_days / maxDays) * 100}%`, background: bandTint(i), borderLeft: `3px solid ${bandColor(i)}` }}
                  >
                    <span className="text-xs font-semibold text-foreground">{b.band_name}</span>
                  </div>
                </div>
                <div className="text-xs font-semibold w-14 text-right">{b.approved_credit_days}d</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Band Name</TableHead>
              <TableHead>Score Range</TableHead>
              <TableHead>Credit Days</TableHead>
              <TableHead>Color</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="text-center text-muted-foreground py-8">No bands configured yet.</TableCell></TableRow>
            ) : sorted.map((b, i) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  {b.band_name}
                  {b.is_ambiguity_band && <Badge variant="secondary" className="ml-2 text-tiny uppercase">Ambiguity</Badge>}
                </TableCell>
                <TableCell>{b.min_score} — {b.max_score}</TableCell>
                <TableCell><Badge variant="info">{b.approved_credit_days} days</Badge></TableCell>
                <TableCell>
                  <span className="block w-4 h-4 rounded" style={{ background: bandColor(i) }} aria-hidden="true" />
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${b.band_name}`} onClick={() => openDialog(b)}><Pencil size={15} /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${b.band_name}`} type="button" className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(b)}><Trash2 size={15} /></Button>
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
          title={`Remove band "${pendingDelete.band_name}"?`}
          description="Removing a band changes the credit days for every score in its range."
          confirmLabel="Remove band"
          tone="destructive"
          reasonLabel=""
          action={confirmDelete}
          hiddenFields={{ id: pendingDelete.id }}
          consequences={[
            `Scores from ${pendingDelete.min_score} to ${pendingDelete.max_score} stop mapping to ${pendingDelete.approved_credit_days} days.`,
            'Open review cycles that use the live policy are affected immediately.',
          ]}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Band' : 'New Score Band'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="policy_version_id" value={activePolicyId || ''} />
            <InlineError message={formError} />
            <div className="space-y-1">
              <Label>Band Name</Label>
              <Input name="band_name" defaultValue={editing?.band_name ?? ''} placeholder="e.g. Band A — Prime" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Min Score</Label>
                <Input name="min_score" type="number" min="0" max="100" defaultValue={editing ? String(editing.min_score) : ''} required />
              </div>
              <div className="space-y-1">
                <Label>Max Score</Label>
                <Input name="max_score" type="number" min="0" max="100" defaultValue={editing ? String(editing.max_score) : ''} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Approved Credit Days</Label>
              <Input name="approved_credit_days" type="number" min="0" defaultValue={editing ? String(editing.approved_credit_days) : ''} required />
            </div>
            <div className="space-y-1 mt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="is_ambiguity_band" defaultChecked={editing?.is_ambiguity_band ?? false} className="accent-primary" value="true" />
                This is an ambiguity band (marks cases as inherently ambiguous)
              </label>
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
