"use client";
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { addDelayReason, deleteDelayReason, toggleDelayReason } from './actions';
import { toast } from 'sonner';

import { useRouter } from 'next/navigation';

interface Props { reasons: { id: string; value: string; is_active: boolean }[] }

export default function DelayReasonManager({ reasons }: Props) {
  const [newReason, setNewReason] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const addLock = useRef(false);
  const router = useRouter();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addLock.current) return;
    addLock.current = true;
    setIsAdding(true);
    const fd = new FormData();
    fd.set('value', newReason);
    try {
      const res = await addDelayReason(fd);
      if ('success' in res) {
        toast.success(res.reactivated ? 'Delay reason reactivated' : 'Delay reason added');
        setNewReason('');
        router.refresh();
      } else toast.error(res.error);
    } catch {
      toast.error('Unable to add the delay reason. Please try again.');
    } finally {
      addLock.current = false;
      setIsAdding(false);
    }
  };

  const handleDelete = async (reason: Props['reasons'][number]) => {
    if (!window.confirm(`Delete “${reason.value}”? This removes it from future selections.`)) return;
    setDeletingId(reason.id);
    const fd = new FormData();
    fd.set('id', reason.id);
    try {
      const res = await deleteDelayReason(fd);
      if (res?.success) {
        toast.success('Delay reason deleted');
        router.refresh();
      } else toast.error(res?.error || 'Failed to delete reason');
    } catch {
      toast.error('Unable to delete the delay reason. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {reasons.map(r => (
        <div key={r.id} className="flex items-center justify-between border rounded-lg px-4 py-2">
          <span className="text-sm">{r.value}</span>
          <div className="flex items-center gap-1">
            <form action={toggleDelayReason}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="is_active" value={String(!r.is_active)} />
              <Button type="submit" size="sm" variant="ghost" className={r.is_active ? 'text-destructive' : 'text-success'}>
                {r.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </form>
            <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${r.value}`} className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={deletingId === r.id} onClick={() => handleDelete(r)}>
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Add new delay reason..." required />
        <Button type="submit" size="sm" disabled={isAdding}><Plus size={14} /> {isAdding ? 'Adding…' : 'Add'}</Button>
      </form>
    </div>
  );
}
