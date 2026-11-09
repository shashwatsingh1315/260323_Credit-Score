"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { handleMergeParties } from './actions';
import { Shuffle } from 'lucide-react';

import { useRouter } from 'next/navigation';

export default function AliasesClient({ parties }: { parties: any[] }) {
  const [primaryId, setPrimaryId] = useState('');
  const [duplicateId, setDuplicateId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const primary = parties.find(p => p.id === primaryId);
  const duplicate = parties.find(p => p.id === duplicateId);
  const duplicateAliasCount = duplicate?.aliases?.length ?? 0;

  const openConfirm = () => {
    if (!primaryId || !duplicateId) {
      setError('Please select both a primary and duplicate party.');
      return;
    }
    if (primaryId === duplicateId) {
      setError('Cannot merge a party into itself.');
      return;
    }
    setError('');
    setConfirmOpen(true);
  };

  // Runs from the ConfirmDialog form. Errors are shown inline on the card.
  const runMerge = async (fd: FormData) => {
    setIsPending(true);
    setError('');
    try {
      await handleMergeParties(fd);
      setDuplicateId('');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'The merge could not be completed. Please try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Party Merge & Aliases</h1>
          <p className="text-sm text-muted-foreground">Consolidate duplicate candidate parties into a single master record.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand"><Shuffle size={18} /> Merge Parties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="merge-primary" className="text-sm font-medium">1. Select Primary Record (Keep)</label>
                <select id="merge-primary" value={primaryId} onChange={e => setPrimaryId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="">-- Select Primary --</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.is_candidate ? '(Cand)' : ''}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="merge-duplicate" className="text-sm font-medium text-destructive">2. Select Duplicate (Merge & Delete)</label>
                <select id="merge-duplicate" value={duplicateId} onChange={e => setDuplicateId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="">-- Select Duplicate --</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.is_candidate ? '(Cand)' : ''}</option>)}
                </select>
                <p className="text-tiny text-muted-foreground mt-1">
                  The duplicate will be deleted. All related cases, history, and exposure will be moved to the Primary record. The duplicate's name will be saved as an Alias.
                </p>
              </div>

              {error && <p role="alert" className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded">{error}</p>}

              <Button onClick={openConfirm} disabled={isPending || !primaryId || !duplicateId} className="w-full bg-brand hover:bg-brand/90">
                {isPending ? 'Merging...' : 'Review Merge'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Party Master List</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Legal Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Known Aliases</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parties.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-sm">
                          {p.legal_name}
                          <span className="block text-tiny text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">{p.id}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.is_candidate ? "warning" : "default"} className="text-tiny">
                            {p.is_candidate ? 'Candidate' : 'Verified'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.aliases?.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">None</span>
                            ) : (
                              p.aliases?.map((a: any) => (
                                <Badge key={a.id} variant="secondary" className="text-tiny bg-muted">{a.alias_name}</Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Merge and delete duplicate party?"
        description={primary && duplicate ? `“${duplicate.legal_name}” will be merged into “${primary.legal_name}”.` : undefined}
        consequences={[
          `“${duplicate?.legal_name ?? 'The duplicate'}” is deleted as a party record.`,
          'Its cases, history and exposure move to the primary party.',
          `Its name is saved as an alias of the primary party${duplicateAliasCount > 0 ? `, alongside its ${duplicateAliasCount} existing alias(es)` : ''}.`,
        ]
        }
        irreversible
        tone="destructive"
        confirmLabel="Merge parties"
        reasonLabel=""
        hiddenFields={{ primary_id: primaryId, duplicate_id: duplicateId }}
        action={async (fd) => {
          await runMerge(fd);
        }}
      />
    </div>
  );
}
