"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit, ArrowUpDown } from 'lucide-react';
import { upsertWeightMatrix, deleteWeightMatrix } from '../actions';

export default function WeightsClient({ matrices, personas, parameters }: { matrices: any[]; personas: any[]; parameters: any[] }) {
  const [editingMatrix, setEditingMatrix] = useState<any | null>(null);
  const [filterPersona, setFilterPersona] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    if (editingMatrix?.id) fd.set('id', editingMatrix.id);

    await upsertWeightMatrix(fd);
    setEditingMatrix(null);
  };

  const filtered = (filterPersona ? matrices.filter(m => m.persona_id === filterPersona) : matrices)
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;

      let valA, valB;
      if (key === 'persona') {
        valA = a.persona?.name || '';
        valB = b.persona?.name || '';
      } else if (key === 'parameter') {
        valA = a.parameter?.name || '';
        valB = b.parameter?.name || '';
      } else if (key === 'stage') {
        valA = a.parameter?.stage || 0;
        valB = b.parameter?.stage || 0;
      } else {
        valA = a[key];
        valB = b[key];
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Weight Matrices</h1>
          <p className="text-sm text-muted-foreground">Assign specific weights to parameters based on persona.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingMatrix ? 'Edit Weight' : 'New Weight Mapping'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-2">
                  <Label>Persona</Label>
                  <select name="persona_id" defaultValue={editingMatrix?.persona_id || ''} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                    <option value="">-- Select Persona --</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Parameter</Label>
                  <select name="parameter_id" defaultValue={editingMatrix?.parameter_id || ''} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                    <option value="">-- Select Parameter --</option>
                    {parameters.map(p => <option key={p.id} value={p.id}>[Stage {p.stage}] {p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Weight</Label>
                  <Input type="number" step="0.01" name="weight" defaultValue={editingMatrix?.weight || 1.0} required />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="w-full">{editingMatrix ? 'Save Changes' : 'Create Mapping'}</Button>
                  {editingMatrix && <Button type="button" variant="outline" onClick={() => setEditingMatrix(null)}>Cancel</Button>}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2">
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Mappings</CardTitle>
              <select value={filterPersona} onChange={e => setFilterPersona(e.target.value)} className="h-8 rounded border px-2 text-xs">
                <option value="">All Personas</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => handleSort('persona')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-1">Persona <ArrowUpDown size={12} /></div>
                    </TableHead>
                    <TableHead onClick={() => handleSort('parameter')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-1">Parameter <ArrowUpDown size={12} /></div>
                    </TableHead>
                    <TableHead onClick={() => handleSort('stage')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-1">Stage <ArrowUpDown size={12} /></div>
                    </TableHead>
                    <TableHead onClick={() => handleSort('weight')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-1">Weight <ArrowUpDown size={12} /></div>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-brand">{m.persona?.name}</TableCell>
                      <TableCell>{m.parameter?.name}</TableCell>
                      <TableCell>Stage {m.parameter?.stage}</TableCell>
                      <TableCell className="font-bold">{m.weight}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingMatrix(m)}>
                            <Edit size={14} />
                          </Button>
                          <form action={deleteWeightMatrix}>
                            <input type="hidden" name="id" value={m.id} />
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 size={14} />
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No weight matrices configured.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}