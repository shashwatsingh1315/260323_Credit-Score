"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { upsertPersona } from '../actions';
import { Pencil, Plus, ChevronLeft, Users2, GitBranch, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Persona { id: string; name: string; description: string; minimum_score: number; }

export default function PersonasClient({ initialPersonas }: { initialPersonas: Persona[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Persona | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Persona, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof Persona) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPersonas = [...initialPersonas].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/policy"><Button variant="ghost" size="sm"><ChevronLeft size={15} /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Persona Models</h1>
          <p className="text-sm text-muted-foreground">Configure scoring persona templates by entity type</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={15} /> New Persona</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1">Persona Name <ArrowUpDown size={12} /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('minimum_score')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1">Min Score <ArrowUpDown size={12} /></div>
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPersonas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
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
                  <Badge variant="outline">{p.minimum_score}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-md truncate">
                  {p.description || 'No description'}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil size={15} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Persona' : 'New Persona'}</DialogTitle></DialogHeader>
          <form action={upsertPersona} onSubmit={() => setOpen(false)} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-1">
              <Label>Persona Name</Label>
              <Input name="persona_name" defaultValue={editing?.name} placeholder="e.g. Large Enterprise" required />
            </div>
            <div className="space-y-1">
              <Label>Minimum Approval Score</Label>
              <Input name="minimum_score" type="number" defaultValue={editing?.minimum_score} required />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea name="description" defaultValue={editing?.description} rows={3} />
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
