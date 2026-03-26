"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit } from 'lucide-react';
import { upsertDominanceCategory, deleteDominanceCategory } from '../actions';

interface DominanceClientProps {
  categories: any[];
  activePolicyId?: string;
}

export default function DominanceClient({ categories, activePolicyId }: DominanceClientProps) {
  const [editingCat, setEditingCat] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    if (editingCat?.id) fd.set('id', editingCat.id);
    if (activePolicyId) fd.set('policy_version_id', activePolicyId);

    await upsertDominanceCategory(fd);
    setEditingCat(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Dominance Categories</h1>
          <p className="text-sm text-muted-foreground">Manage how customer and contractor scores are combined.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingCat ? 'Edit Category' : 'New Category'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Category Name</Label>
                  <Input name="name" defaultValue={editingCat?.name || ''} required />
                </div>

                <div className="space-y-2">
                  <Label>Combination Method</Label>
                  <select name="combination_method" defaultValue={editingCat?.combination_method || 'weighted'} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="weighted">Weighted Blend</option>
                    <option value="power_law">Power Law</option>
                    <option value="customer_only">Customer Only</option>
                    <option value="contractor_only">Contractor Only</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Wgt</Label>
                    <Input name="customer_weight" type="number" step="0.01" defaultValue={editingCat?.customer_weight ?? 0.5} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contractor Wgt</Label>
                    <Input name="contractor_weight" type="number" step="0.01" defaultValue={editingCat?.contractor_weight ?? 0.5} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Exponent (Power Law)</Label>
                  <Input name="exponent" type="number" step="0.01" defaultValue={editingCat?.exponent ?? 1.0} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="w-full">{editingCat ? 'Save Changes' : 'Create'}</Button>
                  {editingCat && <Button type="button" variant="outline" onClick={() => setEditingCat(null)}>Cancel</Button>}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Cust Wgt</TableHead>
                    <TableHead>Cont Wgt</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="capitalize">{c.combination_method.replace('_', ' ')}</TableCell>
                      <TableCell>{c.customer_weight}</TableCell>
                      <TableCell>{c.contractor_weight}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingCat(c)}>
                            <Edit size={14} />
                          </Button>
                          <form action={deleteDominanceCategory}>
                            <input type="hidden" name="id" value={c.id} />
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 size={14} />
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No dominance categories configured.</TableCell></TableRow>
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
