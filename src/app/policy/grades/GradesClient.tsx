"use client";
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { upsertGradeDefinition } from '../actions';
import { Pencil, Plus, ChevronLeft, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { InlineError, ReadOnlyNotice, Receipt } from '../PolicyFeedback';
import type { ActionResult } from '../policy-parsing';

interface Grade {
  id: string;
  grade_label: string;
  grade_value: number;
  description: string;
  policy_version_id: string;
}

export default function GradesClient({ initialGrades, policyVersionId, backHref = '/policy', readOnlyReason = null }: {
  initialGrades: Grade[];
  policyVersionId?: string | null;
  backHref?: string;
  readOnlyReason?: string | null;
}) {
  // Render from props so revalidated server data shows after save.
  const grades = initialGrades;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [sortConfig, setSortConfig] = useState<{ key: keyof Grade, direction: 'asc' | 'desc' } | null>({ key: 'grade_value', direction: 'desc' });

  const handleSort = (key: keyof Grade) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedGrades = [...grades].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const openDialog = (grade: Grade | null) => {
    setEditing(grade);
    setFormError(null);
    setOpen(true);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError(null);
    startSave(async () => {
      const result: ActionResult = await upsertGradeDefinition(formData);
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
          <h1 className="text-xl font-bold">Grade Scales</h1>
          <p className="text-sm text-muted-foreground">Manage grade definitions and numeric values</p>
        </div>
      </div>

      <ReadOnlyNotice reason={readOnlyReason} />
      <Receipt message={receipt} />

      {grades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No grades defined yet.</p>
            {canEdit ? (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => openDialog(null)}>
                <Plus size={15} /> Add First Grade
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="mt-4" disabled title={readOnlyReason ?? undefined}>
                <Plus size={15} /> Add First Grade
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">System Grade Scale</CardTitle>
            </div>
            {canEdit ? (
              <Button size="sm" onClick={() => openDialog(null)}>
                <Plus size={15} /> Add Grade
              </Button>
            ) : (
              <Button size="sm" disabled title={readOnlyReason ?? undefined}>
                <Plus size={15} /> Add Grade
              </Button>
            )}
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('grade_label')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-1">Label <ArrowUpDown size={12} /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('grade_value')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-1">Grade Value <ArrowUpDown size={12} /></div>
                </TableHead>
                <TableHead>Description</TableHead>
                {canEdit && <TableHead className="text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGrades.map((g) => (
                <TableRow key={g.id}>
                  <TableCell><Badge variant="info">{g.grade_label}</Badge></TableCell>
                  <TableCell>{g.grade_value}</TableCell>
                  <TableCell className="text-muted-foreground">{g.description || '-'}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${g.grade_label}`} onClick={() => openDialog(g)}>
                        <Pencil size={15} />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Grade' : 'New Grade Definition'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="policy_version_id" value={policyVersionId || ''} />
            <InlineError message={formError} />
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <Label>Grade Label</Label>
                <Input name="grade_label" defaultValue={editing?.grade_label ?? ''} placeholder="e.g. A, B+, Satisfactory" required />
              </div>
              <div className="space-y-1">
                <Label>Grade Value</Label>
                <Input name="grade_value" type="number" defaultValue={editing ? String(editing.grade_value) : ''} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea name="description" defaultValue={editing?.description ?? ''} rows={2} />
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
