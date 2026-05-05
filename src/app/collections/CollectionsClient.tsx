"use client";
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { logUpdate, snoozeCase } from './actions';

export default function CollectionsClient({ collections, stats, escalations }: any) {
  const [showNeglected, setShowNeglected] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'update' | 'snooze' | null>(null);
  const [outcome, setOutcome] = useState('');
  const [ptpDate, setPtpDate] = useState('');
  
  const now = new Date().getTime();

  // Helper to process cases
  const processedCases = collections.map((c: any) => {
    // Sort escalations by created_at desc, pick the latest
    const activeEsc = c.escalations?.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    const status = activeEsc?.status || 'active';
    
    let isNeglected = false;
    if (activeEsc?.last_hq_update_at) {
      const daysSinceUpdate = (now - new Date(activeEsc.last_hq_update_at).getTime()) / 86400000;
      isNeglected = daysSinceUpdate > 3;
    } else {
      isNeglected = true; // No updates yet
    }

    return { ...c, activeEsc, boardStatus: status, isNeglected };
  });

  const displayCases = processedCases.filter((c: any) => !showNeglected || c.isNeglected);

  const overdue = displayCases.filter((c: any) => c.boardStatus === 'active');
  const snoozed = displayCases.filter((c: any) => c.boardStatus === 'snoozed');
  const broken = displayCases.filter((c: any) => c.boardStatus === 'broken_promise');

  const handleSave = async () => {
    if (!selectedCase?.activeEsc?.id) return;
    if (modalMode === 'update') {
      await logUpdate(selectedCase.id, selectedCase.activeEsc.id, outcome);
    } else if (modalMode === 'snooze') {
      await snoozeCase(selectedCase.id, selectedCase.activeEsc.id, ptpDate, outcome);
    }
    setModalMode(null);
    setOutcome('');
    setPtpDate('');
  };

  const renderCard = (c: any) => (
    <Card key={c.id} className={`p-4 mb-3 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${c.isNeglected ? 'border-l-destructive bg-destructive/5' : 'border-l-primary'}`} onClick={() => setSelectedCase(c)}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-bold text-sm">{c.case_number}</span>
        {c.isNeglected && <AlertCircle className="w-4 h-4 text-destructive" />}
      </div>
      <p className="text-sm font-semibold truncate mb-1">{c.customer?.legal_name || 'Unknown'}</p>
      <p className="text-xs text-muted-foreground mb-3">₹{(c.decided_bill_amount || c.bill_amount || 0).toLocaleString('en-IN')}</p>
      
      <div className="flex gap-2 text-xs text-muted-foreground">
        {c.activeEsc?.ptp_date && (
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> PTP: {new Date(c.activeEsc.ptp_date).toLocaleDateString()}</span>
        )}
        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3"/> {c.activeEsc?.last_hq_update_at ? 'Updated' : 'No logs'}</span>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Collections CRM</h1>
          <p className="text-sm text-muted-foreground">Manage Promise-to-Pay and active escalations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="neglect-mode" checked={showNeglected} onCheckedChange={setShowNeglected} />
          <Label htmlFor="neglect-mode" className="text-destructive font-semibold">Show Neglected ({'>'}3 Days)</Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Overdue */}
        <div className="bg-muted/30 p-4 rounded-xl border">
          <h3 className="font-bold mb-4 flex justify-between">Overdue / Active <Badge>{overdue.length}</Badge></h3>
          <div className="min-h-[200px]">{overdue.map(renderCard)}</div>
        </div>

        {/* Snoozed */}
        <div className="bg-muted/30 p-4 rounded-xl border">
          <h3 className="font-bold mb-4 flex justify-between text-orange-600">Snoozed / PTP <Badge variant="secondary">{snoozed.length}</Badge></h3>
          <div className="min-h-[200px]">{snoozed.map(renderCard)}</div>
        </div>

        {/* Broken Promises */}
        <div className="bg-muted/30 p-4 rounded-xl border">
          <h3 className="font-bold mb-4 flex justify-between text-destructive">Broken Promises <Badge variant="destructive">{broken.length}</Badge></h3>
          <div className="min-h-[200px]">{broken.map(renderCard)}</div>
        </div>
      </div>

      {/* Action Modal */}
      <Dialog open={!!modalMode} onOpenChange={(open) => !open && setModalMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === 'update' ? 'Log HQ Update' : 'Set Promise-To-Pay (Snooze)'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {modalMode === 'snooze' && (
              <div className="space-y-2">
                <Label>Promise Date</Label>
                <Input type="date" value={ptpDate} onChange={e => setPtpDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>{modalMode === 'snooze' ? 'PTP Details / Notes' : 'Call/Visit Outcome'}</Label>
              <Textarea placeholder="What did the customer say?" value={outcome} onChange={e => setOutcome(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMode(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!outcome || (modalMode === 'snooze' && !ptpDate)}>Save Action</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case Details Modal (Quick action picker) */}
      <Dialog open={!!selectedCase && !modalMode} onOpenChange={(open) => !open && setSelectedCase(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCase?.case_number} - {selectedCase?.customer?.legal_name}</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col gap-3">
            <Button onClick={() => setModalMode('update')} className="w-full justify-start" variant="outline"><MessageSquare className="mr-2 w-4 h-4"/> Log Standard Update</Button>
            <Button onClick={() => setModalMode('snooze')} className="w-full justify-start text-orange-600 border-orange-200 hover:bg-orange-50" variant="outline"><Calendar className="mr-2 w-4 h-4"/> Set Promise-To-Pay (Snooze)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}