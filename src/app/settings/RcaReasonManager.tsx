"use client";
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { addRcaReason, deleteRcaReason, toggleRcaReason } from './actions';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';

import { useRouter } from 'next/navigation';

interface Props { reasons: { id: string; value: string; is_active: boolean }[] }

export default function RcaReasonManager({ reasons }: Props) {
  const [newReason, setNewReason] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Props['reasons'][number] | null>(null);
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
      const res = await addRcaReason(fd);
      if ('success' in res) {
        toast.success(res.reactivated ? 'Credit reason reactivated' : 'Credit reason added');
        setNewReason('');
        router.refresh();
      } else toast.error(res.error);
    } catch {
      toast.error('Unable to add the credit reason. Please try again.');
    } finally {
      addLock.current = false;
      setIsAdding(false);
    }
  };

  const handleDelete = async (fd: FormData) => {
    const id = fd.get('id') as string;
    setDeletingId(id);
    try {
      const res = await deleteRcaReason(fd);
      if (res?.success) {
        toast.success('Credit reason deleted');
        router.refresh();
      } else toast.error(res?.error || 'Failed to delete reason');
    } catch {
      toast.error('Unable to delete the credit reason. Please try again.');
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
            <form action={toggleRcaReason}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="is_active" value={String(!r.is_active)} />
              <Button type="submit" size="sm" variant="ghost" className={r.is_active ? 'text-destructive' : 'text-success'}>
                {r.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </form>
            <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${r.value}`} className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={deletingId === r.id} onClick={() => setPendingDelete(r)}>
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Add new reason..." required />
        <Button type="submit" size="sm" disabled={isAdding}><Plus size={14} /> {isAdding ? 'Adding…' : 'Add'}</Button>
      </form>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title={`Delete “${pendingDelete?.value ?? ''}”?`}
        consequences={[
          'It stops appearing as a choice for new selections.',
          'This cannot be undone. Re-add it manually if you need it again.',
        ]}
        tone="destructive"
        confirmLabel="Delete credit reason"
        reasonLabel=""
        hiddenFields={pendingDelete ? { id: pendingDelete.id } : {}}
        action={(fd) => handleDelete(fd)}
      />
    </div>
  );
}
