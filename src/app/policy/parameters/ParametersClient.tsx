"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { upsertParameter, deleteParameter } from '../actions';
import { Pencil, Trash2, Plus, ChevronLeft, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';

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
  rubric_guidance: string; 
  is_active: boolean;
  policy_version_id: string;
}

export default function ParametersClient({ initialParams }: { initialParams: Parameter[] }) {
  const [params, setParams] = useState(initialParams);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parameter | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Parameter, direction: 'asc' | 'desc' } | null>(null);

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

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (p: Parameter) => { setEditing(p); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/policy"><Button variant="ghost" size="sm"><ChevronLeft size={15} /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Scoring Parameters</h1>
          <p className="text-sm text-muted-foreground">Define and weight parameters used in scoring assessments</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus size={15} /> Add Parameter</Button>
      </div>

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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No parameters yet.</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline">Stage {p.stage}</Badge></TableCell>
                <TableCell className="text-muted-foreground capitalize">{p.subject_type}</TableCell>
                <TableCell className="text-muted-foreground">{p.input_type}</TableCell>
                <TableCell>{p.weight}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant="secondary">{p.default_owning_role.toUpperCase()}</Badge>
                    <Badge variant="outline">{p.signal_lag}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil size={15} /></Button>
                    <form action={deleteParameter}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button variant="ghost" size="icon" type="submit" className="text-destructive hover:text-destructive"><Trash2 size={15} /></Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Parameter' : 'New Parameter'}</DialogTitle>
          </DialogHeader>
          <form action={upsertParameter} onSubmit={() => setOpen(false)} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="col-span-2 space-y-1">
                <Label>Parameter Name</Label>
                <Input name="parameter_name" defaultValue={editing?.name} required />
              </div>
              <div className="space-y-1">
                <Label>Subject Type</Label>
                <select name="applies_to_subject" defaultValue={editing?.subject_type || 'customer'} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="customer">Customer</option>
                  <option value="contractor">Contractor</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Stage (1-3)</Label>
                <Input name="stage" type="number" min="1" max="3" defaultValue={editing?.stage || 1} required />
              </div>
              <div className="space-y-1">
                <Label>Owning Role</Label>
                <select name="default_owning_role" defaultValue={editing?.default_owning_role || 'rm'} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="rm">RM</option>
                  <option value="kam">KAM</option>
                  <option value="bdo">BDO</option>
                  <option value="accounts">ACCOUNTS</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Input Type</Label>
                <select name="data_type" defaultValue={editing?.input_type || 'grade_select'} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="grade_select">Grade 1-5 Select</option>
                  <option value="text">Text Entry</option>
                  <option value="file">File Upload</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Weight</Label>
                <Input name="weight" type="number" step="0.01" min="0" max="100" defaultValue={editing?.weight || 1} required />
              </div>
              <div className="space-y-1">
                <Label>Lag Type</Label>
                <select name="signal_lag" defaultValue={editing?.signal_lag || 'Leading'} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="Leading">Leading</option>
                  <option value="Lagging">Lagging</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Strength (1-5)</Label>
                <Input name="signal_strength" type="number" min="1" max="5" defaultValue={editing?.signal_strength || 3} />
              </div>
              <div className="space-y-1">
                <Label>Cost (1-5)</Label>
                <Input name="signal_cost" type="number" min="1" max="5" defaultValue={editing?.signal_cost || 3} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Rubric Guidance (Description & Ratings)</Label>
                <Textarea name="description" defaultValue={editing?.rubric_guidance} rows={4} className="text-xs" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
