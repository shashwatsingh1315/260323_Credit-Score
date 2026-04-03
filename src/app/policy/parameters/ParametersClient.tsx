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
  auto_band_config?: any;
  is_active: boolean;
  policy_version_id: string;
}

export default function ParametersClient({ initialParams }: { initialParams: Parameter[] }) {
  const [params, setParams] = useState(initialParams);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parameter | null>(null);
  const [inputType, setInputType] = useState('grade_select');
  const [autoBandRules, setAutoBandRules] = useState<any[]>([]);
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

  const openNew = () => {
    setEditing(null);
    setInputType('grade_select');
    setAutoBandRules([]);
    setOpen(true);
  };
  const openEdit = (p: Parameter) => {
    setEditing(p);
    // Handle legacy 'dropdown' value that was previously allowed in UI but rejected by DB
    const mappedType = p.input_type === 'dropdown' ? 'link_list' : (p.input_type || 'grade_select');
    setInputType(mappedType);
    setAutoBandRules(p.auto_band_config?.bands || p.auto_band_config?.mappings || []);
    setOpen(true);
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
    if (inputType === 'numeric') {
      setAutoBandRules([...autoBandRules, { min: 0, max: 0, grade: 1 }]);
    } else {
      setAutoBandRules([...autoBandRules, { value: '', grade: 1 }]);
    }
  };

  const removeRule = (idx: number) => {
    setAutoBandRules(autoBandRules.filter((_, i) => i !== idx));
  };

  const updateRule = (idx: number, field: string, val: any) => {
    const updated = [...autoBandRules];
    updated[idx][field] = val;
    setAutoBandRules(updated);
  };

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
                <select
                  name="data_type"
                  value={inputType}
                  onChange={(e) => {
                    setInputType(e.target.value);
                    setAutoBandRules([]); // Reset rules when type changes
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

              {(inputType === 'numeric' || inputType === 'link_list' || inputType === 'yes_no') && (
                <div className="col-span-2 space-y-3 p-4 border rounded-md bg-muted/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label>Auto-Mapping / Banding Rules</Label>
                      <p className="text-tiny text-muted-foreground">Map raw values to a 1-5 grade.</p>
                    </div>
                    <div className="flex gap-2">
                      <Label className="cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80 h-7 px-3 flex items-center justify-center rounded-md text-xs">
                        Upload CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                      </Label>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addRule}>
                        <Plus size={12} className="mr-1" /> Add Rule
                      </Button>
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
                              onChange={(e) => updateRule(idx, 'value', e.target.value)}
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
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(idx)}>
                            <Trash2 size={14} />
                          </Button>
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
              <Button type="submit">{editing ? 'Save Changes' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
