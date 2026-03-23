"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { upsertGradeDefinition } from '../actions';
import { Pencil, Plus, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface Grade { 
  id: string; 
  grade_label: string; 
  min_score: number; 
  max_score: number; 
  numeric_value: number; 
  description: string; 
  policy_version_id: string;
}

export default function GradesClient({ initialGrades }: { initialGrades: Grade[] }) {
  const [grades, setGrades] = useState(initialGrades);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/policy"><Button variant="ghost" size="sm"><ChevronLeft size={15} /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Grade Scales</h1>
          <p className="text-sm text-muted-foreground">Manage grade definitions, score ranges, and numeric values</p>
        </div>
      </div>

      {grades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No grades defined yet.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus size={15} /> Add First Grade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">System Grade Scale</CardTitle>
            </div>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus size={15} /> Add Grade
            </Button>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Score Range</TableHead>
                <TableHead>Numeric Value</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.sort((a, b) => b.min_score - a.min_score).map((g) => (
                <TableRow key={g.id}>
                  <TableCell><Badge variant="info">{g.grade_label}</Badge></TableCell>
                  <TableCell>{g.min_score} — {g.max_score}</TableCell>
                  <TableCell>{g.numeric_value}</TableCell>
                  <TableCell className="text-muted-foreground">{g.description || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(g); setOpen(true); }}>
                      <Pencil size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Grade' : 'New Grade Definition'}</DialogTitle></DialogHeader>
          <form action={upsertGradeDefinition} onSubmit={() => setOpen(false)} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Grade Label</Label>
                <Input name="grade_label" defaultValue={editing?.grade_label} placeholder="e.g. A, B+, Satisfactory" required />
              </div>
              <div className="space-y-1">
                <Label>Min Score</Label>
                <Input name="min_score" type="number" defaultValue={editing?.min_score} required />
              </div>
              <div className="space-y-1">
                <Label>Max Score</Label>
                <Input name="max_score" type="number" defaultValue={editing?.max_score} required />
              </div>
              <div className="space-y-1">
                <Label>Numeric Value</Label>
                <Input name="numeric_value" type="number" step="0.01" defaultValue={editing?.numeric_value} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea name="description" defaultValue={editing?.description} rows={2} />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
