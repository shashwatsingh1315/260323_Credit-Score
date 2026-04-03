"use client";
import { useState, useTransition } from 'react';
import {
  CheckCircle, Clock, AlertCircle, Plus, Pencil, Trash2,
  Lock, Unlock, ExternalLink, FileX, BookOpen, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  handleSaveBillingDetails,
  handleLogPayment,
  handleEditPayment,
  handleDeletePayment,
  handleIssueCreditNote,
  handleCancelBilling,
  handleAttemptClose,
  handleWriteOffApproval,
  handleCreditNoteApproval,
  handleRestructureTranches,
} from './billing-actions';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────

interface Tranche {
  index: number;
  dueDate: Date | null;
  expectedAmount: number;
  paidAmount: number;
  status: 'Paid' | 'Partial' | 'Delayed' | 'Upcoming' | 'No Billing';
}

interface Repayment {
  id: string;
  amount: number;
  payment_date: string;
  reference_url: string | null;
  description: string | null;
  logged_by: string | null;
  created_at: string;
  logged_by_profile?: { full_name: string } | null;
}

interface CreditNote {
  id: string;
  reduction_amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  logged_by_profile?: { full_name: string } | null;
  approved_by_profile?: { full_name: string } | null;
}

interface LedgerData {
  billing: {
    billingDate: string | null;
    decidedAmount: number | null;
    promisedAmount: number | null;
    actualAmount: number;
    isLocked: boolean;
  };
  tranches: Tranche[];
  prefillAmount: number;
  repayments: Repayment[];
  creditNotes: CreditNote[];
  status: string;
}

interface LedgerTabProps {
  caseId: string;
  activeRole: string;
  ledger: LedgerData;
}

// ── Helpers ────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  n != null ? `₹${n.toLocaleString('en-IN')}` : '—';

const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const TRANCHE_COLORS: Record<string, string> = {
  Paid:     'bg-emerald-500',
  Partial:  'bg-amber-400',
  Delayed:  'bg-destructive',
  Upcoming: 'bg-muted-foreground/40',
  'No Billing': 'bg-muted',
};

const TRANCHE_BADGE: Record<string, any> = {
  Paid:     'success',
  Partial:  'warning',
  Delayed:  'destructive',
  Upcoming: 'secondary',
  'No Billing': 'secondary',
};

// ── Main Component ─────────────────────────────────────────────────

export default function LedgerTab({ caseId, activeRole, ledger }: LedgerTabProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const isAdmin   = activeRole === 'founder_admin';
  const isKam     = activeRole === 'kam' || isAdmin;
  const isRm      = activeRole === 'rm' || isAdmin;

  const { billing, tranches, prefillAmount, repayments, creditNotes, status } = ledger;

  const billingActive         = status === 'Billing Active';
  const pendingWriteOff       = status === 'Pending Write-Off Approval';
  const isClosed              = status === 'Closed' || status === 'Cancelled';

  // ── Billing Frame State ─────────────────────────────────────────
  const [showBillingEdit, setShowBillingEdit] = useState(!billing.billingDate && isRm);
  const [billingDate, setBillingDate]         = useState(billing.billingDate?.split('T')[0] ?? '');
  const [decidedAmt, setDecidedAmt]           = useState(billing.decidedAmount?.toString() ?? '');
  const [promisedAmt, setPromisedAmt]         = useState(billing.promisedAmount?.toString() ?? '');

  // ── Payment Form State ──────────────────────────────────────────
  const [showAddPayment, setShowAddPayment]   = useState(false);
  const [payAmount, setPayAmount]             = useState(prefillAmount > 0 ? prefillAmount.toString() : '');
  const [payDate, setPayDate]                 = useState(new Date().toISOString().split('T')[0]);
  const [payUrl, setPayUrl]                   = useState('');
  const [payDesc, setPayDesc]                 = useState('');

  // ── Edit Payment State ──────────────────────────────────────────
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount]             = useState('');
  const [editDate, setEditDate]                 = useState('');
  const [editUrl, setEditUrl]                   = useState('');
  const [editDesc, setEditDesc]                 = useState('');

  // ── Credit Note State ───────────────────────────────────────────
  const [showCreditNote, setShowCreditNote]   = useState(false);
  const [cnAmount, setCnAmount]               = useState('');
  const [cnReason, setCnReason]               = useState('');

  // ── Cancel State ────────────────────────────────────────────────
  const [showCancel, setShowCancel]           = useState(false);
  const [cancelReason, setCancelReason]       = useState('');

  const wrap = (fn: () => Promise<void>) => {
    setError('');
    startTransition(async () => {
      try { await fn(); }
      catch (e: any) { setError(e.message || 'An error occurred.'); }
    });
  };

  const startEditPayment = (p: Repayment) => {
    setEditingPaymentId(p.id);
    setEditAmount(p.amount.toString());
    setEditDate(p.payment_date);
    setEditUrl(p.reference_url ?? '');
    setEditDesc(p.description ?? '');
  };

  // ── Margin ──────────────────────────────────────────────────────
  const margin = billing.decidedAmount && billing.decidedAmount > 0
    ? (((billing.actualAmount) / billing.decidedAmount) - 1) * 100
    : null;

  // ── Collect Rate ────────────────────────────────────────────────
  const collectPct = billing.promisedAmount && billing.promisedAmount > 0
    ? Math.min(100, (billing.actualAmount / billing.promisedAmount) * 100)
    : null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/30 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm">
          {error}
        </div>
      )}

      {/* ── BILLING FRAME ─────────────────────────────────────── */}
      <Card className={cn("rounded-2xl border-border/50 shadow-sm transition-all", billingActive && 'border-primary/40 shadow-md', pendingWriteOff && 'border-warning/60 shadow-md')}>
        <CardHeader className="pb-4 border-b border-border/30 bg-muted/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", billing.isLocked ? "bg-muted/50 border-border/50 text-muted-foreground" : "bg-success/10 border-success/20 text-success")}>
                {billing.isLocked
                  ? <Lock size={16} />
                  : <Unlock size={16} />}
              </div>
              Billing Frame
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              {billing.isLocked && (
                <Badge variant="secondary" className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-sm">Locked — payments recorded</Badge>
              )}
              {!billing.isLocked && isRm && !isClosed && (
                <Button variant="ghost" size="sm" onClick={() => setShowBillingEdit(v => !v)} className="h-9 rounded-lg font-bold hover:bg-muted transition-colors">
                  {showBillingEdit ? <ChevronUp size={16} className="mr-1" /> : <ChevronDown size={16} className="mr-1" />}
                  {billing.billingDate ? 'Edit' : 'Set Billing'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Billing Date',    value: fmtDate(billing.billingDate) },
              { label: 'Decided Amount',  value: fmt(billing.decidedAmount) },
              { label: 'Promised Amount', value: fmt(billing.promisedAmount) },
              { label: 'Collected',       value: fmt(billing.actualAmount) },
            ].map(d => (
              <div key={d.label} className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{d.label}</p>
                <p className="font-semibold text-lg text-foreground">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {billing.promisedAmount != null && billing.promisedAmount > 0 && (
            <div className="bg-muted/20 p-5 rounded-xl border border-border/40 space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Collection Progress</span>
                <span className={cn("text-xl font-black tracking-tight", (collectPct ?? 0) >= 100 ? "text-success" : "text-primary")}>{collectPct?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-background border border-border/50 rounded-full h-3.5 overflow-hidden shadow-inner">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 ease-out",
                    (collectPct ?? 0) >= 100 ? 'bg-success' : 'bg-primary relative overflow-hidden'
                  )}
                  style={{ width: `${Math.min(100, collectPct ?? 0)}%` }}
                >
                  {(collectPct ?? 0) < 100 && (collectPct ?? 0) > 0 && (
                    <div className="absolute top-0 bottom-0 left-0 right-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px] animate-[shimmer_2s_linear_infinite]" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Margin badge */}
          {margin !== null && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Margin:</span>
              <Badge variant={margin >= 0 ? 'success' : 'destructive'} className="px-3 py-1 text-sm font-bold shadow-sm rounded-lg">
                {margin >= 0 ? '+' : ''}{margin.toFixed(2)}%
              </Badge>
            </div>
          )}

          {/* Edit form */}
          {showBillingEdit && !billing.isLocked && isRm && (
            <div className="pt-4 border-t border-border/40 mt-6 animate-in slide-in-from-top-2 duration-300">
              <form
                action={async (fd) => {
                  fd.set('caseId', caseId);
                  wrap(() => handleSaveBillingDetails(fd));
                  setShowBillingEdit(false);
                }}
                className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-muted/20 p-5 rounded-xl border border-border/40"
              >
                <input type="hidden" name="caseId" value={caseId} />
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Billing Date *</Label>
                  <Input type="date" name="billingDate" value={billingDate}
                    onChange={e => setBillingDate(e.target.value)} required className="h-11 rounded-xl bg-background border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Decided Amount (₹) *</Label>
                  <Input type="number" name="decidedAmount" value={decidedAmt}
                    onChange={e => setDecidedAmt(e.target.value)} placeholder="0" min="1" required className="h-11 rounded-xl bg-background border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Promised Amount (₹) *</Label>
                  <Input type="number" name="promisedAmount" value={promisedAmt}
                    onChange={e => setPromisedAmt(e.target.value)} placeholder="0" min="1" required className="h-11 rounded-xl bg-background border-border/50" />
                </div>
                <div className="col-span-full flex gap-3 pt-2">
                  <Button type="submit" size="sm" disabled={isPending} className="h-10 px-6 rounded-xl font-bold shadow-sm">
                    {isPending ? 'Saving…' : 'Save Billing Details'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setShowBillingEdit(false)} className="h-10 px-6 rounded-xl font-bold hover:bg-muted">Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {/* Pending Write-Off Banner */}
          {pendingWriteOff && isAdmin && (
            <div className="pt-4 border-t border-border/40 mt-6">
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-5 shadow-sm">
                <p className="text-base font-bold text-warning mb-2 flex items-center gap-2"><AlertCircle size={18} /> Pending Write-Off — Awaiting Admin Decision</p>
                <p className="text-sm font-medium text-warning/80 mb-4 bg-background/50 inline-block px-3 py-1.5 rounded-lg border border-warning/20">
                  Shortfall: {fmt((billing.promisedAmount ?? 0) - billing.actualAmount)}
                </p>
                <div className="flex flex-wrap gap-3">
                  <form action={handleWriteOffApproval}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="decision" value="approve" />
                    <Button type="submit" size="sm" className="h-10 px-5 rounded-xl font-bold bg-success hover:bg-success/90 text-success-foreground shadow-sm">
                      Approve Write-Off
                    </Button>
                  </form>
                  <form action={handleWriteOffApproval}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="decision" value="reject" />
                    <Button type="submit" size="sm" variant="outline"
                      className="h-10 px-5 rounded-xl font-bold border-destructive/50 text-destructive hover:bg-destructive/10">
                      Reject — Return to KAM
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── TRANCHE WATERFALL ─────────────────────────────────── */}
      {billing.billingDate && tranches.length > 0 && (
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/30 bg-muted/10">
            <CardTitle className="text-lg font-bold tracking-tight">Tranche Waterfall</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {tranches.map((t) => {
                const fillPct = t.expectedAmount > 0
                  ? Math.min(100, (t.paidAmount / t.expectedAmount) * 100)
                  : 0;
                return (
                  <div key={t.index} className="space-y-3 bg-muted/10 p-5 rounded-xl border border-border/40 transition-colors hover:bg-muted/20">
                    <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                      <span className="font-bold text-base text-foreground">Tranche {t.index + 1}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[11px] bg-background px-2.5 py-1 rounded-md border border-border/50">Due: {fmtDate(t.dueDate)}</span>
                        <Badge variant={TRANCHE_BADGE[t.status] as any} className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md shadow-sm">
                          {t.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-background border border-border/50 rounded-full h-3.5 overflow-hidden shadow-inner">
                      <div
                        className={cn('h-full rounded-full transition-all duration-1000 ease-out relative', TRANCHE_COLORS[t.status])}
                        style={{ width: `${fillPct}%` }}
                      >
                        {fillPct > 0 && fillPct < 100 && (
                           <div className="absolute top-0 bottom-0 left-0 right-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px] animate-[shimmer_2s_linear_infinite]" />
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Paid: <span className="text-foreground text-sm tracking-normal">{fmt(t.paidAmount)}</span></span>
                      <span>Target: <span className="text-foreground text-sm tracking-normal">{fmt(t.expectedAmount)}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── PAYMENT LOG ───────────────────────────────────────── */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/30 bg-muted/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold tracking-tight">Payment Log</CardTitle>
            {isKam && (billingActive || pendingWriteOff) && (
              <Button size="sm" onClick={() => setShowAddPayment(v => !v)} className="h-9 rounded-lg font-bold shadow-sm">
                <Plus size={16} className="mr-1.5" />
                Log Payment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Add Payment Form */}
          {showAddPayment && isKam && (
            <div className="bg-muted/10 border-b border-border/40 p-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
              <p className="text-sm font-bold uppercase tracking-wider text-primary">New Payment Entry</p>
              <form
                action={async (fd) => {
                  fd.set('caseId', caseId);
                  wrap(async () => {
                    await handleLogPayment(fd);
                    setShowAddPayment(false);
                    setPayAmount('');
                    setPayDesc('');
                    setPayUrl('');
                  });
                }}
                className="space-y-4"
              >
                <input type="hidden" name="caseId" value={caseId} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹) *</Label>
                    <Input type="number" name="amount" value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      placeholder="0" min="1" required className="h-11 rounded-xl bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Date *</Label>
                    <Input type="date" name="paymentDate" value={payDate}
                      onChange={e => setPayDate(e.target.value)} required className="h-11 rounded-xl bg-background" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reference URL</Label>
                  <Input name="referenceUrl" value={payUrl} onChange={e => setPayUrl(e.target.value)}
                    placeholder="https://bank-portal/transaction/…" type="url" className="h-11 rounded-xl bg-background" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description / Notes</Label>
                  <Input name="description" value={payDesc} onChange={e => setPayDesc(e.target.value)}
                    placeholder="e.g., Partial advance, NEFT ref #1234…" className="h-11 rounded-xl bg-background" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" size="sm" disabled={isPending} className="h-10 px-6 rounded-xl font-bold shadow-sm">
                    {isPending ? 'Saving…' : 'Save Payment'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setShowAddPayment(false)} className="h-10 px-6 rounded-xl font-bold hover:bg-muted">Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {/* Payment list */}
          {repayments.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground opacity-60">No payments logged yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {repayments.map((p) => (
                <div key={p.id} className="p-6 transition-colors hover:bg-muted/5 group">
                  {editingPaymentId === p.id ? (
                    /* Inline Edit Form */
                    <form
                      action={async (fd) => {
                        fd.set('paymentId', p.id);
                        fd.set('caseId', caseId);
                        wrap(async () => {
                          await handleEditPayment(fd);
                          setEditingPaymentId(null);
                        });
                      }}
                      className="space-y-4 bg-background p-4 rounded-xl border border-border/50 shadow-sm"
                    >
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input type="hidden" name="caseId" value={caseId} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹)</Label>
                          <Input type="number" name="amount" value={editAmount}
                            onChange={e => setEditAmount(e.target.value)} min="1" required className="h-10 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Date</Label>
                          <Input type="date" name="paymentDate" value={editDate}
                            onChange={e => setEditDate(e.target.value)} required className="h-10 rounded-lg" />
                        </div>
                      </div>
                      <Input name="referenceUrl" value={editUrl} onChange={e => setEditUrl(e.target.value)}
                        placeholder="Reference URL" type="url" className="h-10 rounded-lg" />
                      <Input name="description" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        placeholder="Description" className="h-10 rounded-lg" />
                      <div className="flex gap-2 pt-2">
                        <Button type="submit" size="sm" disabled={isPending} className="h-9 px-4 rounded-lg font-bold shadow-sm">Save Changes</Button>
                        <Button type="button" variant="ghost" size="sm"
                          onClick={() => setEditingPaymentId(null)} className="h-9 px-4 rounded-lg font-bold hover:bg-muted">Cancel</Button>
                      </div>
                    </form>
                  ) : (
                    /* Display row */
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                            <CheckCircle size={16} />
                          </div>
                          <span className="text-lg font-bold text-foreground">{fmt(p.amount)}</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{fmtDate(p.payment_date)}</span>
                        </div>
                        <div className="pl-11 space-y-2 mt-2">
                          {p.description && (
                            <p className="text-sm font-medium text-foreground/80">{p.description}</p>
                          )}
                          {p.reference_url && (
                            <a href={p.reference_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-bold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5 bg-primary/5 px-2.5 py-1 rounded-md">
                              <ExternalLink size={12} /> View Reference
                            </a>
                          )}
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                            <span className="opacity-70">Logged by</span> <span className="text-foreground/70">{p.logged_by_profile?.full_name ?? 'Unknown'}</span> <span className="mx-1 opacity-50">·</span>{' '}
                            {new Date(p.created_at).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                      {isKam && !isClosed && (
                        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => startEditPayment(p)}>
                            <Pencil size={14} />
                          </Button>
                          <form action={async (fd) => {
                            fd.set('paymentId', p.id);
                            fd.set('caseId', caseId);
                            if (!confirm(`Delete payment of ${fmt(p.amount)}? This cannot be undone.`)) return;
                            wrap(() => handleDeletePayment(fd));
                          }}>
                            <input type="hidden" name="paymentId" value={p.id} />
                            <input type="hidden" name="caseId" value={caseId} />
                            <Button type="submit" variant="outline" size="icon"
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive border-destructive/20 hover:bg-destructive/10">
                              <Trash2 size={14} />
                            </Button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Manual close button */}
          {isKam && (billingActive || pendingWriteOff) && repayments.length > 0 && (
            <div className="p-6 border-t border-border/30 bg-muted/5 flex justify-end">
              <form action={async (fd) => {
                fd.set('caseId', caseId);
                if (!confirm('Mark this case as closed? Collected amount will be evaluated.')) return;
                wrap(() => handleAttemptClose(fd));
              }}>
                <input type="hidden" name="caseId" value={caseId} />
                <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-10 px-5 rounded-xl font-bold shadow-sm hover:bg-muted">
                  <FileX size={16} className="mr-2" />
                  Mark as Settled / Close
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CREDIT NOTES ──────────────────────────────────────── */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/30 bg-muted/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold tracking-tight">Credit Notes</CardTitle>
            {isKam && !isClosed && billing.isLocked && (
              <Button size="sm" variant="outline" onClick={() => setShowCreditNote(v => !v)} className="h-9 rounded-lg font-bold shadow-sm bg-background">
                <Plus size={16} className="mr-1.5" />
                Issue Credit Note
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {showCreditNote && (
            <div className="bg-muted/10 border-b border-border/40 p-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-1">
                <p className="text-sm font-bold uppercase tracking-wider text-primary">New Credit Note</p>
                <p className="text-xs font-medium text-muted-foreground">
                  Use this to reduce the Promised Amount due to damaged/returned goods. Requires Admin approval.
                </p>
              </div>
              <form
                action={async (fd) => {
                  fd.set('caseId', caseId);
                  wrap(async () => {
                    await handleIssueCreditNote(fd);
                    setShowCreditNote(false);
                    setCnAmount('');
                    setCnReason('');
                  });
                }}
                className="space-y-4 pt-2"
              >
                <input type="hidden" name="caseId" value={caseId} />
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reduction Amount (₹) *</Label>
                  <Input type="number" name="reductionAmount" value={cnAmount}
                    onChange={e => setCnAmount(e.target.value)} placeholder="0" min="1" required className="h-11 rounded-xl bg-background max-w-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason *</Label>
                  <Input name="reason" value={cnReason} onChange={e => setCnReason(e.target.value)}
                    placeholder="e.g., 10 bags of cement were damaged on delivery…" required className="h-11 rounded-xl bg-background" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" size="sm" disabled={isPending} className="h-10 px-6 rounded-xl font-bold shadow-sm">
                    {isPending ? 'Submitting…' : 'Submit for Approval'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setShowCreditNote(false)} className="h-10 px-6 rounded-xl font-bold hover:bg-muted">Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {creditNotes.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground opacity-60">No credit notes issued.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {creditNotes.map(cn => (
                <div key={cn.id} className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-muted/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge
                        variant={cn.status === 'approved' ? 'success' : cn.status === 'rejected' ? 'destructive' : 'warning'}
                        className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md shadow-sm"
                      >
                        {cn.status}
                      </Badge>
                      <span className="text-lg font-bold text-foreground">{fmt(cn.reduction_amount)}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{fmtDate(cn.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground/80 mb-2">{cn.reason}</p>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span className="opacity-70">By</span> <span className="text-foreground/70">{cn.logged_by_profile?.full_name ?? 'Unknown'}</span>
                      {cn.approved_by_profile && <><span className="mx-1 opacity-50">·</span> <span className={cn.status === 'approved' ? 'text-success' : 'text-destructive'}>{cn.status === 'approved' ? 'Approved' : 'Rejected'}</span> <span className="opacity-70">by</span> <span className="text-foreground/70">{cn.approved_by_profile.full_name}</span></>}
                    </p>
                  </div>
                  {/* Approval actions for admin */}
                  {isAdmin && cn.status === 'pending' && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <form action={handleCreditNoteApproval}>
                        <input type="hidden" name="creditNoteId" value={cn.id} />
                        <input type="hidden" name="caseId" value={caseId} />
                        <input type="hidden" name="decision" value="approved" />
                        <Button type="submit" size="sm" className="h-9 px-4 rounded-lg font-bold bg-success hover:bg-success/90 text-success-foreground shadow-sm">
                          Approve
                        </Button>
                      </form>
                      <form action={handleCreditNoteApproval}>
                        <input type="hidden" name="creditNoteId" value={cn.id} />
                        <input type="hidden" name="caseId" value={caseId} />
                        <input type="hidden" name="decision" value="rejected" />
                        <Button type="submit" size="sm" variant="outline"
                          className="h-9 px-4 rounded-lg font-bold border-destructive/50 text-destructive hover:bg-destructive/10">
                          Reject
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CONTRACTOR REPUTATION MVP ──────────────────────────── */}
      <Card className="rounded-2xl border-indigo-500/20 bg-indigo-500/5 shadow-sm">
        <CardHeader className="pb-4 border-b border-indigo-500/10">
          <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
              <BookOpen size={16} />
            </div>
            Contractor Reputation Checks
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest">
            Ground-Truth Instructions (KAM Reference)
          </p>
          <div className="grid gap-3">
            {[
              {
                num: '1',
                title: 'On-Ground Reputation',
                detail: 'Ask labourers, daily-wage workers, chaiwalas, and site supervisors about payment timeliness and reliability of this contractor.',
              },
              {
                num: '2',
                title: '3rd Party Vendor Checks',
                detail: 'Consult plumbers, POP contractors, and civil sub-contractors who have worked alongside or supplied to this contractor.',
              },
              {
                num: '3',
                title: 'Premiumness & Brand Signals',
                detail: 'Identify which TMT, CEMENT, and PIPE brands the contractor typically specifies or purchases — high-grade brands signal financial credibility.',
              },
            ].map(item => (
              <div key={item.num} className="flex gap-4 p-4 rounded-xl bg-background/50 border border-indigo-500/10 shadow-sm transition-all hover:bg-background/80 hover:border-indigo-500/20">
                <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm">
                  {item.num}
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-foreground text-base tracking-tight">{item.title}</p>
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── CANCEL BILLING ─────────────────────────────────────── */}
      {isKam && billingActive && repayments.length === 0 && (
        <div className="flex justify-end pt-4">
          {!showCancel ? (
            <Button variant="ghost" size="sm" className="h-10 px-5 rounded-xl font-bold text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => setShowCancel(true)}>
              <FileX size={16} className="mr-2" />
              Cancel / Abort Order
            </Button>
          ) : (
            <div className="w-full sm:w-auto bg-destructive/5 border border-destructive/30 rounded-xl p-5 shadow-sm animate-in slide-in-from-right-4 duration-300">
              <p className="text-sm font-bold uppercase tracking-wider text-destructive mb-3">Cancel Order — No payments required</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Reason for cancellation…"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="h-11 min-w-[280px] rounded-xl bg-background border-destructive/20 focus-visible:ring-destructive"
                />
                <div className="flex gap-2">
                  <form action={async (fd) => {
                    fd.set('caseId', caseId);
                    fd.set('reason', cancelReason || 'Order cancelled before dispatch.');
                    wrap(() => handleCancelBilling(fd));
                  }}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <Button type="submit" size="sm" variant="destructive" disabled={isPending} className="h-11 px-5 rounded-xl font-bold shadow-sm">
                      {isPending ? 'Cancelling…' : 'Confirm Cancel'}
                    </Button>
                  </form>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowCancel(false)} className="h-11 px-5 rounded-xl font-bold hover:bg-destructive/10 text-destructive">
                    Back
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
