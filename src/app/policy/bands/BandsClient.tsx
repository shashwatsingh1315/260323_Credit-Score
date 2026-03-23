"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { upsertScoreBand, deleteScoreBand } from '../actions';
import { Pencil, Trash2, Plus, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface ScoreBand {
  id: string; band_name: string; min_score: number; max_score: number;
  approved_credit_days: number; color_hex: string;
}

export default function BandsClient({ initialBands }: { initialBands: ScoreBand[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ScoreBand | null>(null);

  const openNew = () => { setEditing(null); setOpen(true); };

  // Build visual band chart
  const sorted = [...initialBands].sort((a, b) => b.min_score - a.min_score);
  const maxDays = Math.max(...initialBands.map(b => b.approved_credit_days), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/policy"><Button variant="ghost" size="sm"><ChevronLeft size={15} /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Score Bands</h1>
          <p className="text-sm text-muted-foreground">Map score ranges to approved credit day buckets</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus size={15} /> Add Band</Button>
      </div>

      {/* Visual mapper */}
      {initialBands.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Score → Credit Days Visual Map</p>
          <div className="space-y-2">
            {sorted.map((b) => (
              <div key={b.id} className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground w-20 shrink-0 text-right">{b.min_score}–{b.max_score}</div>
                <div className="flex-1 relative h-7 rounded overflow-hidden bg-muted">
                  <div
                    className="h-full rounded flex items-center pl-2.5"
                    style={{ width: `${(b.approved_credit_days / maxDays) * 100}%`, background: b.color_hex + '60', borderLeft: `3px solid ${b.color_hex}` }}
                  >
                    <span className="text-xs font-semibold" style={{ color: b.color_hex }}>{b.band_name}</span>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No bands configured yet.</TableCell></TableRow>
            ) : sorted.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.band_name}</TableCell>
                <TableCell>{b.min_score} — {b.max_score}</TableCell>
                <TableCell><Badge variant="info">{b.approved_credit_days} days</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded" style={{ background: b.color_hex }} />
                    <span className="text-xs text-muted-foreground">{b.color_hex}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(b); setOpen(true); }}><Pencil size={15} /></Button>
                    <form action={deleteScoreBand}>
                      <input type="hidden" name="id" value={b.id} />
                      <Button variant="ghost" size="icon" type="submit" className="text-destructive hover:text-destructive"><Trash2 size={15} /></Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Band' : 'New Score Band'}</DialogTitle></DialogHeader>
          <form action={upsertScoreBand} onSubmit={() => setOpen(false)} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-1">
              <Label>Band Name</Label>
              <Input name="band_name" defaultValue={editing?.band_name} placeholder="e.g. Band A — Prime" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Min Score</Label>
                <Input name="min_score" type="number" min="0" max="100" defaultValue={editing?.min_score} required />
              </div>
              <div className="space-y-1">
                <Label>Max Score</Label>
                <Input name="max_score" type="number" min="0" max="100" defaultValue={editing?.max_score} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Approved Credit Days</Label>
              <Input name="approved_credit_days" type="number" min="0" defaultValue={editing?.approved_credit_days} required />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <div className="flex gap-2">
                <input name="color_hex" type="color" defaultValue={editing?.color_hex || '#6366f1'} className="w-12 h-9 rounded border border-input cursor-pointer" />
                <Input defaultValue={editing?.color_hex || '#6366f1'} placeholder="#6366f1" className="flex-1" readOnly />
              </div>
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
