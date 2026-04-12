'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { updateIdPrefix } from './actions';

type IdPrefix = {
  id: string;
  entity_type: string;
  prefix: string;
};

export default function PrefixManager({ prefixes }: { prefixes: IdPrefix[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  async function handleUpdate(entityType: string, newPrefix: string, id: string) {
    setLoadingIds(prev => new Set(prev).add(id));
    setError(null);
    const result = await updateIdPrefix(entityType, newPrefix);
    if (result && result.error) {
      setError(result.error);
    }
    const next = new Set(loadingIds);
    next.delete(id);
    setLoadingIds(next);
  }

  const formatEntityType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm font-medium text-destructive">{error}</div>
      )}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity Type</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prefixes.map((pref) => (
              <TableRow key={pref.id}>
                <TableCell className="font-medium">{formatEntityType(pref.entity_type)}</TableCell>
                <TableCell>
                   <form 
                     onSubmit={(e) => {
                       e.preventDefault();
                       const formData = new FormData(e.currentTarget);
                       const val = formData.get('prefix') as string;
                       handleUpdate(pref.entity_type, val, pref.id);
                     }}
                     className="flex gap-2"
                   >
                       <Input 
                         name="prefix"
                         defaultValue={pref.prefix} 
                         className="font-mono w-24"
                       />
                       <Button 
                         type="submit" 
                         variant="outline" 
                         size="sm" 
                         disabled={loadingIds.has(pref.id)}
                       >
                         Save
                       </Button>
                   </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
