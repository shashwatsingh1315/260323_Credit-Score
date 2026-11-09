'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { addCityCode, deleteCityCode } from './actions';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { toast } from 'sonner';

import { useRouter } from 'next/navigation';

type CityCode = {
  id: string;
  code: string;
  name: string;
};

export default function CityCodeManager({ cityCodes }: { cityCodes: CityCode[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CityCode | null>(null);
  const router = useRouter();

  async function handleAdd(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await addCityCode(formData);
    if (result && result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDelete(fd: FormData) {
    const id = fd.get('id') as string;
    const result = await deleteCityCode(id);
    if (result && result.error) {
      setError(result.error);
      toast.error(result.error);
    } else {
      toast.success('City code deleted');
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm font-medium text-destructive">{error}</div>
      )}
      
      <form action={handleAdd} className="flex gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Code (3 chars)</label>
          <Input 
            name="code" 
            placeholder="e.g. RPR" 
            maxLength={3} 
            required 
            className="w-24 uppercase" 
            onChange={(e) => e.target.value = e.target.value.toUpperCase()}
          />
        </div>
        <div className="space-y-1 flex-1">
          <label className="text-xs font-medium text-muted-foreground">City Name</label>
          <Input name="name" placeholder="e.g. Raipur" required />
        </div>
        <Button type="submit" disabled={loading}>Add City</Button>
      </form>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cityCodes.length === 0 && (
              <TableRow>
                 <TableCell colSpan={3} className="text-center text-muted-foreground">No city codes configured.</TableCell>
              </TableRow>
            )}
            {cityCodes.map((city) => (
              <TableRow key={city.id}>
                <TableCell className="font-mono font-medium">{city.code}</TableCell>
                <TableCell>{city.name}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${city.name} (${city.code})`} onClick={() => setPendingDelete(city)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title={`Delete city code ${pendingDelete?.code ?? ''}?`}
        description={pendingDelete ? `${pendingDelete.name} will no longer be available for new site IDs.` : undefined}
        consequences={[
          'New site IDs can no longer use this code.',
          'Site IDs already issued are not changed.',
          'This cannot be undone. Re-add the code manually if you need it again.',
        ]}
        tone="destructive"
        confirmLabel="Delete city code"
        reasonLabel=""
        hiddenFields={pendingDelete ? { id: pendingDelete.id } : {}}
        action={(fd) => handleDelete(fd)}
      />
    </div>
  );
}
