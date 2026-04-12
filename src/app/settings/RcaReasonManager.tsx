"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { addRcaReason, toggleRcaReason } from './actions';
import { toast } from 'sonner';

import { useRouter } from 'next/navigation';

interface Props { reasons: { id: string; value: string; is_active: boolean }[] }

export default function RcaReasonManager({ reasons }: Props) {
  const [newReason, setNewReason] = useState('');
  const router = useRouter();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set('value', newReason);
    const res = await addRcaReason(fd);
    if (res?.success) { 
      toast.success('Reason added'); 
      setNewReason(''); 
      router.refresh();
    }
    else toast.error(res?.error || 'Failed');
  };

  return (
    <div className="space-y-3">
      {reasons.map(r => (
        <div key={r.id} className="flex items-center justify-between border rounded-lg px-4 py-2">
          <span className="text-sm">{r.value}</span>
          <form action={toggleRcaReason}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="is_active" value={String(!r.is_active)} />
            <Button type="submit" size="sm" variant="ghost" className={r.is_active ? 'text-destructive' : 'text-success'}>
              {r.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </form>
        </div>
      ))}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Add new reason..." required />
        <Button type="submit" size="sm"><Plus size={14} /> Add</Button>
      </form>
    </div>
  );
}
