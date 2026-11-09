"use client";
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { upsertPersona } from '../actions';
import { Pencil, Plus, ChevronLeft, Users2, GitBranch, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InlineError, ReadOnlyNotice, Receipt } from '../PolicyFeedback';
import type { ActionResult } from '../policy-parsing';

interface Persona { id: string; name: string; description: string; minimum_score: number | null; }

export default function PersonasClient({ initialPersonas, policyVersionId, backHref = '/policy', readOnlyReason = null }: {
  initialPersonas: Persona[];
  policyVersionId?: string | null;
  backHref?: string;
  readOnlyReason?: string | null;
}) {
  // Render from props so revalidated server data shows after save.
  const personas = initialPersonas;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Persona | null>(null);
  const [gateEnabled, setGateEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [sortConfig, setSortConfig] = useState<{ key: keyof Persona, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof Persona) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPersonas = [...personas].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const aValue = a[key] ?? '';
    const bValue = b[key] ?? '';
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const openDialog = (persona: Persona | null) => {
    setEditing(persona);
    setGateEnabled(persona ? persona.minimum_score != null : false);
    setFormError(null);
    setOpen(true);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError(null);
    startSave(async () => {
      const result: ActionResult = await upsertPersona(formData);
      if (result.ok) {
        setReceipt(result.message);
        setOpen(false);
      } else {
        setFormError(result.error);
      }
    });
  };

  const canEdit = readOnlyReason === null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}><Button variant="ghost" size="sm"><ChevronLeft size={15} /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Persona Models</h1>
          <p className="text-sm text-muted-foreground">Configure scoring persona templates by entity type</p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => openDialog(null)}><Plus size={15} /> New Persona</Button>
        ) : (
          <Button size="sm" disabled title={readOnlyReason ?? undefined}><Plus size={15} /> New Persona</Button>
        )}
      </div>

      <ReadOnlyNotice reason={readOnlyReason} />
      <Receipt message={receipt} />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1">Persona Name <ArrowUpDown size={12} /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('minimum_score')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1">Gate <ArrowUpDown size={12} /></div>
              </TableHead>
              <TableHead>Description</TableHead>
              {canEdit && <TableHead className="text-right">Edit</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPersonas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 4 : 3} className="text-center py-12 text-muted-foreground">
                  <GitBranch size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No personas defined yet. Create one to get started.</p>
                </TableCell>
              </TableRow>
            ) : sortedPersonas.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users2 size={16} className="text-primary" />
                    </div>
                    {p.name}
                  </div>
                </TableCell>
                <TableCell>
                  {p.minimum_score != null
                    ? <Badge variant="outline">≥ {p.minimum_score}</Badge>
                    : <span className="text-sm text-muted-foreground">No gate</span>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-md truncate">
                  {p.description || 'No description'}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => openDialog(p)}>
                      <Pencil size={15} />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Persona' : 'New Persona'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="policy_version_id" value={policyVersionId || ''} />
            <InlineError message={formError} />
            <div className="space-y-1">
              <Label>Persona Name</Label>
              <Input name="persona_name" defaultValue={editing?.name ?? ''} placeholder="e.g. Large Enterprise" required />
            </div>
            <div className="space-y-2 rounded-md border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="minimum_score_enabled" value="true" checked={gateEnabled} onChange={(event) => setGateEnabled(event.target.checked)} />
                Enforce a minimum case score
              </label>
              {gateEnabled && <Input name="minimum_score" type="number" min="0" max="100" defaultValue={editing?.minimum_score != null ? String(editing.minimum_score) : '60'} required />}
              <p className="text-xs text-muted-foreground">Below this score the case is flagged ambiguous and routed to board review.</p>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea name="description" defaultValue={editing?.description ?? ''} rows={3} />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
