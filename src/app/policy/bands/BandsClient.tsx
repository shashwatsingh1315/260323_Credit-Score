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
  approved_credit_days: number;
  is_ambiguity_band: boolean;
}

const fallbackColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

export default function BandsClient({ initialBands, activePolicyId }: { initialBands: ScoreBand[], activePolicyId: string | null }) {
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
            {sorted.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground w-20 shrink-0 text-right">{b.min_score}–{b.max_score}</div>
                <div className="flex-1 relative h-7 rounded overflow-hidden bg-muted">
                  <div
                    className="h-full rounded flex items-center pl-2.5"
                    style={{ width: `${(b.approved_credit_days / maxDays) * 100}%`, background: fallbackColors[i % fallbackColors.length] + '60', borderLeft: `3px solid ${fallbackColors[i % fallbackColors.length]}` }}
                  >
                    <span className="text-xs font-semibold" style={{ color: fallbackColors[i % fallbackColors.length] }}>{b.band_name}</span>
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
            ) : sorted.map((b, i) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  {b.band_name}
                  {b.is_ambiguity_band && <Badge variant="secondary" className="ml-2 text-[10px] uppercase">Ambiguity</Badge>}
                </TableCell>
                <TableCell>{b.min_score} — {b.max_score}</TableCell>
                <TableCell><Badge variant="info">{b.approved_credit_days} days</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded" style={{ background: fallbackColors[i % fallbackColors.length] }} />
                    <span className="text-xs text-muted-foreground">{fallbackColors[i % fallbackColors.length]}</span>
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
            <input type="hidden" name="policy_version_id" value={activePolicyId || ''} />
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
            <div className="space-y-1 mt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="is_ambiguity_band" defaultChecked={editing?.is_ambiguity_band} className="accent-primary" value="true" />
                This is an ambiguity band (marks cases as inherently ambiguous)
              </label>
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
