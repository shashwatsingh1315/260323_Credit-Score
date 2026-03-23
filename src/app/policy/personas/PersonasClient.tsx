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
import { Pencil, Plus, ChevronLeft, Users2, GitBranch } from 'lucide-react';
import Link from 'next/link';

interface Persona { id: string; name: string; description: string; minimum_score: number; }

export default function PersonasClient({ initialPersonas }: { initialPersonas: Persona[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Persona | null>(null);

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

      <div className="grid grid-cols-2 gap-4">
        {initialPersonas.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            <GitBranch size={40} className="mx-auto mb-3 opacity-30" />
            <p>No personas defined yet. Create one to get started.</p>
          </div>
        )}
        {initialPersonas.map((p) => (
          <Card key={p.id} className="hover:border-primary/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users2 size={16} className="text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <Badge variant="outline" className="mt-0.5 text-xs">Min Score: {p.minimum_score}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}>
                  <Pencil size={15} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-3">{p.description || 'No description'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
