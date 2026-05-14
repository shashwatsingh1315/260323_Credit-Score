"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, ShieldAlert, ArrowUpRight, Search, FileText, MessageSquare, CheckSquare } from 'lucide-react';
import { handleEscalateCase, bulkAssignRMs, addHqCollectionLog } from './actions';
import { handleLogPayment } from '@/app/cases/[id]/billing-actions';
import { SubmitButton } from '@/components/ui/submit-button';


interface Case {
  id: string;
  case_number: string;
  status: string;
  bill_amount: number;
  decided_bill_amount?: number | null;
  actual_bill_amount?: number | null;
  composite_credit_days?: number;
  escalation_level?: number;
  billing_date?: string | null;
  proposed_tranches?: any;
  customer?: { legal_name: string }[] | { legal_name: string } | null;
  rm?: { full_name: string }[] | { full_name: string } | null;
  case_attributes?: any;
}

function computeOverdueTranches(c: Case): {
  trancheIndex: number;
  expectedAmount: number;
  paidAmount: number;
  dueDate: Date;
  daysOverdue: number;
  outstanding: number;
}[] {
  if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) return [];
  const billingDate = new Date(c.billing_date);
  const billAmt = c.decided_bill_amount;
  let remaining = c.actual_bill_amount ?? 0;
  const now = new Date();
  const result = [];

  for (let i = 0; i < c.proposed_tranches.length; i++) {
    const t = c.proposed_tranches[i];
    const amt = t.type === 'percentage'
      ? Math.round((t.value / 100) * billAmt)
      : Math.round(t.value);
    const fill = Math.min(remaining, amt);
    remaining -= fill;
    const unpaid = amt - fill;
    if (unpaid > 0) {
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 3600 * 24));
      if (daysOverdue > 0) {
        result.push({ trancheIndex: i, expectedAmount: amt, paidAmount: fill, dueDate: due, daysOverdue, outstanding: unpaid });
      }
    }
  }
  return result;
}

function getCustomerName(c: Case): string {
  if (!c.customer) return '—';
  if (Array.isArray(c.customer)) return c.customer[0]?.legal_name || '—';
  return c.customer.legal_name || '—';
}

function getRmName(c: Case): string {
  const original = (c.case_attributes as any)?.original_rm_name;
  if (original) return original;
  if (!c.rm) return 'Unassigned';
  if (Array.isArray(c.rm)) return c.rm[0]?.full_name || 'Unassigned';
  return c.rm.full_name || 'Unassigned';
}

export default function CollectionsClient({ collections, stats, escalations, rms = [], hqLogs = [] }: {
  collections: Case[];
  stats: { totalOverdue: number; countOverdue: number; totalEscalated: number; countEscalated: number };
  escalations: any[];
  rms?: { id: string; full_name: string }[];
  hqLogs?: any[];
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'overdue_days' | 'outstanding' | 'name'>('overdue_days');
  const [minOverdueDays, setMinOverdueDays] = useState(0);
  const [filterRm, setFilterRm] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterHqUpdate, setFilterHqUpdate] = useState('all'); // all, updated, pending
  const [filterEscalation, setFilterEscalation] = useState('all');
  const [filterRecency, setFilterRecency] = useState('all'); // all, 7d, 14d, none


  const [loggingPaymentForCase, setLoggingPaymentForCase] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [selectedRm, setSelectedRm] = useState('');
  
  const [chatOpenForCase, setChatOpenForCase] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedCaseIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedCaseIds(newSet);
  };

  const handleQuickLogPayment = async (caseId: string) => {
    setPaymentSubmitting(true);
    setPaymentError('');
    
    const c = collections.find(x => x.id === caseId);
    const overdue = c ? computeOverdueTranches(c) : [];
    if (overdue.length === 0) {
      setPaymentError('No overdue tranches found for this case.');
      setPaymentSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.set('caseId', caseId);
    fd.set('amount', paymentAmount);
    fd.set('paymentDate', paymentDate);
    fd.set('description', paymentNote || 'Logged from Collections dashboard');
    fd.set('trancheIndex', overdue[0].trancheIndex.toString());

    try {
      await handleLogPayment(fd);
      setLoggingPaymentForCase(null);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (e: any) {
      setPaymentError(e.message);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const filtered = collections.filter(c => {
    const matchesSearch = getCustomerName(c).toLowerCase().includes(search.toLowerCase()) ||
      c.case_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.id.includes(search) ||
      getRmName(c).toLowerCase().includes(search.toLowerCase());

    const matchesRm = filterRm === 'all' || getRmName(c) === filterRm;
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    
    const hasLogs = hqLogs.some(log => log.case_id === c.id);
    const matchesHq = filterHqUpdate === 'all' || 
      (filterHqUpdate === 'updated' && hasLogs) || 
      (filterHqUpdate === 'pending' && !hasLogs);

    const matchesEscalation = filterEscalation === 'all' || (c.escalation_level ?? 0).toString() === filterEscalation;

    let matchesRecency = true;
    if (filterRecency !== 'all') {
      const caseLogs = hqLogs.filter(log => log.case_id === c.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastLog = caseLogs[0];
      if (filterRecency === 'none') {
        matchesRecency = !lastLog;
      } else {
        if (!lastLog) {
          matchesRecency = false;
        } else {
          const daysSince = (new Date().getTime() - new Date(lastLog.created_at).getTime()) / 86400000;
          if (filterRecency === '7d') matchesRecency = daysSince <= 7;
          else if (filterRecency === '14d') matchesRecency = daysSince >= 14;
        }
      }
    }

    return matchesSearch && matchesRm && matchesStatus && matchesHq && matchesEscalation && matchesRecency;
  });


  // Get unique RM names for the filter dropdown
  const uniqueRms = Array.from(new Set(collections.map(c => getRmName(c)))).sort();

  const getOverdueDays = (c: Case): number => {
    if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) return 0;
    
    const now = new Date();
    const billingDate = new Date(c.billing_date);
    let remaining = c.actual_bill_amount ?? 0;
    
    let maxOverdue = 0;
  
    for (const t of c.proposed_tranches as any[]) {
      const amt = t.type === 'percentage'
        ? Math.round((t.value / 100) * c.decided_bill_amount)
        : Math.round(t.value);
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      
      const fill = Math.min(remaining, amt);
      remaining -= fill;
      const unpaid = amt - fill;
      
      if (unpaid > 0) {
        const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86400000);
        if (daysOverdue > maxOverdue) {
          maxOverdue = daysOverdue;
        }
      }
    }
    return maxOverdue;
  };

  const getOutstanding = (c: Case): number => {
    const billed = c.decided_bill_amount || c.bill_amount || 0;
    const collected = c.actual_bill_amount || 0;
    return Math.max(0, billed - collected);
  };

  const sorted = [...filtered]
    .filter(c => {
      const maxOverdue = Math.max(...computeOverdueTranches(c).map(t => t.daysOverdue), 0);
      return maxOverdue >= minOverdueDays;
    })
    .sort((a, b) => {
      if (sortBy === 'overdue_days') {
        const aMax = Math.max(...computeOverdueTranches(a).map(t => t.daysOverdue), 0);
        const bMax = Math.max(...computeOverdueTranches(b).map(t => t.daysOverdue), 0);
        return bMax - aMax;
      }
      if (sortBy === 'outstanding') return getOutstanding(b) - getOutstanding(a);
      return getCustomerName(a).localeCompare(getCustomerName(b));
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Collections & Escalations</h1>
          <p className="text-sm text-muted-foreground">Monitor overdue cases and manage recovery escalations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={18} className="text-amber-500" />
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Total Overdue</p>
            </div>
            <p className="text-3xl font-bold">₹{(stats.totalOverdue || 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.countOverdue} case{stats.countOverdue !== 1 ? 's' : ''} currently past SLA</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={18} className="text-destructive" />
              <p className="text-sm font-semibold text-destructive uppercase tracking-wider">High Risk Escalations</p>
            </div>
            <p className="text-3xl font-bold">₹{(stats.totalEscalated || 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.countEscalated} case{stats.countEscalated !== 1 ? 's' : ''} requiring immediate attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-muted/30 p-4 rounded-lg border">
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input 
            placeholder="Search customer, RM or case..." 
            className="pl-9 h-9 text-sm bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:flex items-center gap-3 w-full lg:w-auto">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">RM</label>
            <select value={filterRm} onChange={e => setFilterRm(e.target.value)} className="text-sm border rounded px-2 py-1 h-9 bg-background min-w-[120px]">
              <option value="all">All RMs</option>
              {uniqueRms.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border rounded px-2 py-1 h-9 bg-background">
              <option value="all">All Status</option>
              <option value="Billing Active">Billing Active</option>
              <option value="Pending Write-Off Approval">Pending Write-Off</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">HQ Update</label>
            <select value={filterHqUpdate} onChange={e => setFilterHqUpdate(e.target.value)} className="text-sm border rounded px-2 py-1 h-9 bg-background">
              <option value="all">Any Update</option>
              <option value="updated">With Logs</option>
              <option value="pending">No Logs Yet</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Escalation</label>
            <select value={filterEscalation} onChange={e => setFilterEscalation(e.target.value)} className="text-sm border rounded px-2 py-1 h-9 bg-background">
              <option value="all">All Levels</option>
              <option value="0">Level 0</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Recency</label>
            <select value={filterRecency} onChange={e => setFilterRecency(e.target.value)} className="text-sm border rounded px-2 py-1 h-9 bg-background">
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="14d">Older than 14d</option>
              <option value="none">Never Updated</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Sort</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="text-sm border rounded px-2 py-1 h-9 bg-background">
              <option value="overdue_days">By Overdue</option>
              <option value="outstanding">By Amount</option>
              <option value="name">By Name</option>
            </select>
          </div>
        </div>
      </div>



      {selectedCaseIds.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-md p-3 flex items-center justify-between">
          <div className="text-sm font-medium">
            <CheckSquare size={16} className="inline mr-2 text-primary" />
            {selectedCaseIds.size} case{selectedCaseIds.size !== 1 ? 's' : ''} selected
          </div>
          <form action={bulkAssignRMs} className="flex items-center gap-2">
            <input type="hidden" name="caseIds" value={JSON.stringify(Array.from(selectedCaseIds))} />
            <select name="rmId" value={selectedRm} onChange={e => setSelectedRm(e.target.value)} className="text-sm border rounded px-2 py-1 h-9 bg-background" required>
              <option value="">Select RM to Assign...</option>
              {rms.map(rm => <option key={rm.id} value={rm.id}>{rm.full_name}</option>)}
            </select>
            <SubmitButton type="submit" size="sm" disabled={!selectedRm}>Assign RM</SubmitButton>
          </form>

        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {sorted.length === 0 ? (
          <Card className="py-12 border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText size={24} className="text-muted-foreground" />
              </div>
              <p className="text-base font-semibold">No Collections Data</p>
              <p className="text-sm text-muted-foreground">All clear or no matches found.</p>
            </CardContent>
          </Card>
        ) : (
          sorted.map((c) => {
            const overdueDays = getOverdueDays(c);
            const outstanding = getOutstanding(c);
            const isEscalated = (c.escalation_level ?? 0) > 0;
            const nextLevel = (c.escalation_level ?? 0) + 1;
            const targetRole = escalations.find(e => e.escalation_level === nextLevel)?.escalate_to_role || 'founder_admin';

            return (
              <Card key={c.id} className={isEscalated ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}>
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <input 
                         type="checkbox" 
                         checked={selectedCaseIds.has(c.id)} 
                         onChange={() => toggleSelection(c.id)} 
                         className="w-4 h-4 cursor-pointer mr-1"
                       />
                       <h3 className="font-semibold text-base">{getCustomerName(c)}</h3>
                       <Badge variant={isEscalated ? 'destructive' : 'warning'} className="text-xs uppercase py-0 tracking-widest">
                         {isEscalated ? `Escalation L${c.escalation_level}` : 'Overdue'}
                       </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        <Link href={`/cases/${c.id}`} className="hover:underline font-mono text-xs">
                          {c.case_number || c.id.split('-')[0]}
                        </Link>
                      </span>
                      <span>•</span>
                      <span className="font-medium text-foreground">
                        RM: {getRmName(c)}
                      </span>
                      <span>•</span>
                      <span className="font-medium text-foreground">
                        ₹{outstanding.toLocaleString('en-IN')} outstanding
                      </span>
                    </div>
                    {computeOverdueTranches(c).map(t => (
                      <div key={t.trancheIndex} className="flex items-center gap-3 text-sm mt-1">
                        <span className="text-destructive font-semibold">
                          Tranche {t.trancheIndex + 1}: ₹{t.outstanding.toLocaleString('en-IN')} outstanding
                        </span>
                        <span className="text-muted-foreground text-xs">
                          Due {t.dueDate.toLocaleDateString('en-IN')} · {t.daysOverdue} days overdue
                        </span>
                      </div>
                    ))}
                    {c.billing_date && (
                      <p className="text-xs text-muted-foreground">
                        RM Handover: {new Date(c.billing_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' · '}Credit Terms: {c.composite_credit_days || 0} days
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-green-500 text-green-700 hover:bg-green-50"
                      onClick={() => setLoggingPaymentForCase(loggingPaymentForCase === c.id ? null : c.id)}
                    >
                      ₹ Log Payment
                    </Button>
                    <form action={handleEscalateCase}>
                      <input type="hidden" name="caseId" value={c.id} />
                      {/* Tranche Index not passed yet in escalation modal, defaulting to 0 or we can leave it to be handled by backend. The action expects trancheIndex. Let's pass the worst overdue tranche. */}
                      <input type="hidden" name="trancheIndex" value={computeOverdueTranches(c).sort((a, b) => b.daysOverdue - a.daysOverdue)[0]?.trancheIndex || 0} />
                      <input type="hidden" name="targetRole" value={targetRole} />
                      <SubmitButton
                        type="submit"
                        variant={isEscalated ? "destructive" : "outline"}
                        size="sm"
                        className={!isEscalated ? "border-amber-500 text-amber-600 hover:bg-amber-50" : ""}
                        loadingText="Escalating..."
                      >
                        <ArrowUpRight size={14} className="mr-1.5" /> 
                        Escalate
                      </SubmitButton>
                    </form>

                    <Button variant="outline" size="sm" onClick={() => setChatOpenForCase(c.id)}>
                      <MessageSquare size={14} className="mr-1.5" /> HQ Chat
                    </Button>
                    <Link href={`/cases/${c.id}`} passHref>
                      <Button variant="secondary" size="sm">View Case</Button>
                    </Link>
                  </div>
                </CardContent>
                {loggingPaymentForCase === c.id && (
                  <div className="mx-6 mb-6 mt-0 p-4 border border-green-200 rounded-md bg-green-50 space-y-3">
                    <p className="text-sm font-semibold text-green-800">Log a Payment</p>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        placeholder="Amount (₹)"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        className="flex-1 border rounded px-2 py-1 text-sm bg-white"
                      />
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                        className="border rounded px-2 py-1 text-sm bg-white"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={paymentNote}
                      onChange={e => setPaymentNote(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm bg-white"
                    />
                    {paymentError && <p className="text-xs text-red-600">{paymentError}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleQuickLogPayment(c.id)} disabled={!paymentAmount || paymentSubmitting}>
                        {paymentSubmitting ? 'Saving...' : 'Save Payment'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setLoggingPaymentForCase(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {chatOpenForCase && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/50">
              <h3 className="font-semibold">HQ Contact Log</h3>
              <Button variant="ghost" size="sm" onClick={() => setChatOpenForCase(null)}>Close</Button>
            </div>
            <CardContent className="p-0">
              <div className="h-64 overflow-y-auto p-4 space-y-4">
                {hqLogs.filter(log => log.case_id === chatOpenForCase).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center mt-10">No interactions logged yet.</p>
                ) : (
                  hqLogs.filter(log => log.case_id === chatOpenForCase).map(log => (
                    <div key={log.id} className="bg-muted/40 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start mb-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{log.logged_by_user?.full_name || 'System'}</span>
                        <span>{new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <p>{log.message}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t bg-muted/20">
                <form action={addHqCollectionLog} className="flex gap-2" onSubmit={() => setTimeout(() => setChatMessage(''), 100)}>
                  <input type="hidden" name="caseId" value={chatOpenForCase} />
                  <Input 
                    name="message" 
                    placeholder="Log a call or remark..." 
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    required 
                    autoComplete="off"
                  />
                  <SubmitButton type="submit" size="sm">Log</SubmitButton>
                </form>

              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
