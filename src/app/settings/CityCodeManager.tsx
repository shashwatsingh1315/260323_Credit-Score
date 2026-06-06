'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { addCityCode, deleteCityCode } from './actions';
import { Trash2 } from 'lucide-react';

import { useRouter } from 'next/navigation';

type CityCode = {
  id: string;
  code: string;
  name: string;
};

export default function CityCodeManager({ cityCodes }: { cityCodes: CityCode[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this city code?')) {
      const result = await deleteCityCode(id);
      if (result && result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
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
              <TableHead className="w-12"></TableHead>
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
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(city.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
