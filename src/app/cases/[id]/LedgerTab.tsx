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
    <div className="space-y-5">
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/30 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ── BILLING FRAME ─────────────────────────────────────── */}
      <Card className={cn(billingActive && 'border-primary/40', pendingWriteOff && 'border-amber-500/60')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {billing.isLocked
                ? <Lock size={15} className="text-muted-foreground" />
                : <Unlock size={15} className="text-emerald-400" />}
              Billing Frame
            </CardTitle>
            <div className="flex items-center gap-2">
              {billing.isLocked && (
                <Badge variant="secondary" className="text-xs">Locked — payments recorded</Badge>
              )}
              {!billing.isLocked && isRm && !isClosed && (
                <Button variant="ghost" size="sm" onClick={() => setShowBillingEdit(v => !v)}>
                  {showBillingEdit ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {billing.billingDate ? 'Edit' : 'Set Billing'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Billing Date',    value: fmtDate(billing.billingDate) },
              { label: 'Decided Amount',  value: fmt(billing.decidedAmount) },
              { label: 'Promised Amount', value: fmt(billing.promisedAmount) },
              { label: 'Collected',       value: fmt(billing.actualAmount) },
            ].map(d => (
              <div key={d.label}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{d.label}</p>
                <p className="font-semibold">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {billing.promisedAmount != null && billing.promisedAmount > 0 && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Collection progress</span>
                <span>{collectPct?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    (collectPct ?? 0) >= 100 ? 'bg-emerald-500' : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(100, collectPct ?? 0)}%` }}
                />
              </div>
            </div>
          )}

          {/* Margin badge */}
          {margin !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Margin:</span>
              <Badge variant={margin >= 0 ? 'success' : 'destructive'} className="text-xs">
                {margin >= 0 ? '+' : ''}{margin.toFixed(2)}%
              </Badge>
            </div>
          )}

          {/* Edit form */}
          {showBillingEdit && !billing.isLocked && isRm && (
            <>
              <Separator />
              <form
                action={async (fd) => {
                  fd.set('caseId', caseId);
                  wrap(() => handleSaveBillingDetails(fd));
                  setShowBillingEdit(false);
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                <input type="hidden" name="caseId" value={caseId} />
                <div className="space-y-1">
                  <Label>Billing Date *</Label>
                  <Input type="date" name="billingDate" value={billingDate}
                    onChange={e => setBillingDate(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Decided Amount (₹) *</Label>
                  <Input type="number" name="decidedAmount" value={decidedAmt}
                    onChange={e => setDecidedAmt(e.target.value)} placeholder="0" min="1" required />
                </div>
                <div className="space-y-1">
                  <Label>Promised Amount (₹) *</Label>
                  <Input type="number" name="promisedAmount" value={promisedAmt}
                    onChange={e => setPromisedAmt(e.target.value)} placeholder="0" min="1" required />
                </div>
                <div className="col-span-full flex gap-2">
                  <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save Billing Details'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setShowBillingEdit(false)}>Cancel</Button>
                </div>
              </form>
            </>
          )}

          {/* Pending Write-Off Banner */}
          {pendingWriteOff && isAdmin && (
            <>
              <Separator />
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-600 mb-2">⚠ Pending Write-Off — Awaiting Admin Decision</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Shortfall: {fmt((billing.promisedAmount ?? 0) - billing.actualAmount)}
                </p>
                <div className="flex gap-2">
                  <form action={handleWriteOffApproval}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="decision" value="approve" />
                    <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                      Approve Write-Off
                    </Button>
                  </form>
                  <form action={handleWriteOffApproval}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="decision" value="reject" />
                    <Button type="submit" size="sm" variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10">
                      Reject — Return to KAM
                    </Button>
                  </form>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── TRANCHE WATERFALL ─────────────────────────────────── */}
      {billing.billingDate && tranches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tranche Waterfall</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tranches.map((t) => {
                const fillPct = t.expectedAmount > 0
                  ? Math.min(100, (t.paidAmount / t.expectedAmount) * 100)
                  : 0;
                return (
                  <div key={t.index} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Tranche {t.index + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">Due: {fmtDate(t.dueDate)}</span>
                        <Badge variant={TRANCHE_BADGE[t.status] as any} className="text-xs">
                          {t.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className={cn('h-2.5 rounded-full transition-all', TRANCHE_COLORS[t.status])}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Paid: {fmt(t.paidAmount)}</span>
                      <span>Target: {fmt(t.expectedAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── PAYMENT LOG ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Payment Log</CardTitle>
            {isKam && (billingActive || pendingWriteOff) && (
              <Button size="sm" onClick={() => setShowAddPayment(v => !v)}>
                <Plus size={14} className="mr-1.5" />
                Log Payment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add Payment Form */}
          {showAddPayment && isKam && (
            <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold">New Payment Entry</p>
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
                className="space-y-3"
              >
                <input type="hidden" name="caseId" value={caseId} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Amount (₹) *</Label>
                    <Input type="number" name="amount" value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      placeholder="0" min="1" required />
                  </div>
                  <div className="space-y-1">
                    <Label>Payment Date *</Label>
                    <Input type="date" name="paymentDate" value={payDate}
                      onChange={e => setPayDate(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Reference URL</Label>
                  <Input name="referenceUrl" value={payUrl} onChange={e => setPayUrl(e.target.value)}
                    placeholder="https://bank-portal/transaction/…" type="url" />
                </div>
                <div className="space-y-1">
                  <Label>Description / Notes</Label>
                  <Input name="description" value={payDesc} onChange={e => setPayDesc(e.target.value)}
                    placeholder="e.g., Partial advance, NEFT ref #1234…" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save Payment'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setShowAddPayment(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {/* Payment list */}
          {repayments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              No payments logged yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {repayments.map((p) => (
                <div key={p.id} className="py-3">
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
                      className="space-y-2"
                    >
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input type="hidden" name="caseId" value={caseId} />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label>Amount (₹)</Label>
                          <Input type="number" name="amount" value={editAmount}
                            onChange={e => setEditAmount(e.target.value)} min="1" required />
                        </div>
                        <div className="space-y-1">
                          <Label>Payment Date</Label>
                          <Input type="date" name="paymentDate" value={editDate}
                            onChange={e => setEditDate(e.target.value)} required />
                        </div>
                      </div>
                      <Input name="referenceUrl" value={editUrl} onChange={e => setEditUrl(e.target.value)}
                        placeholder="Reference URL" type="url" />
                      <Input name="description" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        placeholder="Description" />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={isPending}>Save</Button>
                        <Button type="button" variant="ghost" size="sm"
                          onClick={() => setEditingPaymentId(null)}>Cancel</Button>
                      </div>
                    </form>
                  ) : (
                    /* Display row */
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                          <span className="text-sm font-semibold">{fmt(p.amount)}</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(p.payment_date)}</span>
                        </div>
                        {p.description && (
                          <p className="text-xs text-muted-foreground ml-5">{p.description}</p>
                        )}
                        {p.reference_url && (
                          <a href={p.reference_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline ml-5 flex items-center gap-1">
                            <ExternalLink size={10} /> View Reference
                          </a>
                        )}
                        <p className="text-xs text-muted-foreground ml-5 mt-0.5">
                          Logged by {p.logged_by_profile?.full_name ?? 'Unknown'} ·{' '}
                          {new Date(p.created_at).toLocaleString('en-IN')}
                        </p>
                      </div>
                      {isKam && !isClosed && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => startEditPayment(p)}>
                            <Pencil size={13} />
                          </Button>
                          <form action={async (fd) => {
                            fd.set('paymentId', p.id);
                            fd.set('caseId', caseId);
                            if (!confirm(`Delete payment of ${fmt(p.amount)}? This cannot be undone.`)) return;
                            wrap(() => handleDeletePayment(fd));
                          }}>
                            <input type="hidden" name="paymentId" value={p.id} />
                            <input type="hidden" name="caseId" value={caseId} />
                            <Button type="submit" variant="ghost" size="sm"
                              className="text-destructive hover:bg-destructive/10">
                              <Trash2 size={13} />
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
            <div className="pt-2 border-t border-border">
              <form action={async (fd) => {
                fd.set('caseId', caseId);
                if (!confirm('Mark this case as closed? Collected amount will be evaluated.')) return;
                wrap(() => handleAttemptClose(fd));
              }}>
                <input type="hidden" name="caseId" value={caseId} />
                <Button type="submit" size="sm" variant="outline" disabled={isPending}>
                  <FileX size={14} className="mr-1.5" />
                  Mark as Settled / Close
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CREDIT NOTES ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Credit Notes</CardTitle>
            {isKam && !isClosed && billing.isLocked && (
              <Button size="sm" variant="outline" onClick={() => setShowCreditNote(v => !v)}>
                <Plus size={14} className="mr-1.5" />
                Issue Credit Note
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showCreditNote && (
            <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold">New Credit Note</p>
              <p className="text-xs text-muted-foreground">
                Use this to reduce the Promised Amount due to damaged/returned goods. Requires Admin approval.
              </p>
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
                className="space-y-3"
              >
                <input type="hidden" name="caseId" value={caseId} />
                <div className="space-y-1">
                  <Label>Reduction Amount (₹) *</Label>
                  <Input type="number" name="reductionAmount" value={cnAmount}
                    onChange={e => setCnAmount(e.target.value)} placeholder="0" min="1" required />
                </div>
                <div className="space-y-1">
                  <Label>Reason *</Label>
                  <Input name="reason" value={cnReason} onChange={e => setCnReason(e.target.value)}
                    placeholder="e.g., 10 bags of cement were damaged on delivery…" required />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? 'Submitting…' : 'Submit for Approval'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setShowCreditNote(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {creditNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-2">No credit notes issued.</p>
          ) : (
            <div className="divide-y divide-border">
              {creditNotes.map(cn => (
                <div key={cn.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge
                        variant={cn.status === 'approved' ? 'success' : cn.status === 'rejected' ? 'destructive' : 'warning'}
                        className="text-xs capitalize"
                      >
                        {cn.status}
                      </Badge>
                      <span className="text-sm font-semibold">{fmt(cn.reduction_amount)}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(cn.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{cn.reason}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      By {cn.logged_by_profile?.full_name ?? 'Unknown'}
                      {cn.approved_by_profile && ` · ${cn.status === 'approved' ? 'Approved' : 'Rejected'} by ${cn.approved_by_profile.full_name}`}
                    </p>
                  </div>
                  {/* Approval actions for admin */}
                  {isAdmin && cn.status === 'pending' && (
                    <div className="flex gap-1 shrink-0">
                      <form action={handleCreditNoteApproval}>
                        <input type="hidden" name="creditNoteId" value={cn.id} />
                        <input type="hidden" name="caseId" value={caseId} />
                        <input type="hidden" name="decision" value="approved" />
                        <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                          Approve
                        </Button>
                      </form>
                      <form action={handleCreditNoteApproval}>
                        <input type="hidden" name="creditNoteId" value={cn.id} />
                        <input type="hidden" name="caseId" value={caseId} />
                        <input type="hidden" name="decision" value="rejected" />
                        <Button type="submit" size="sm" variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10">
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
      <Card className="border-indigo-200/40 bg-indigo-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen size={15} className="text-indigo-400" />
            Contractor Reputation Checks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            Ground-Truth Instructions (KAM Reference)
          </p>
          <div className="space-y-2">
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
              <div key={item.num} className="flex gap-3 p-3 rounded-lg bg-muted/40">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {item.num}
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{item.title}</p>
                  <p className="text-xs mt-0.5">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── CANCEL BILLING ─────────────────────────────────────── */}
      {isKam && billingActive && repayments.length === 0 && (
        <div className="flex justify-end">
          {!showCancel ? (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowCancel(true)}>
              <FileX size={14} className="mr-1.5" />
              Cancel / Abort Order
            </Button>
          ) : (
            <div className="w-full bg-destructive/5 border border-destructive/30 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-destructive">Cancel Order — No payments required</p>
              <Input
                placeholder="Reason for cancellation…"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
              <div className="flex gap-2">
                <form action={async (fd) => {
                  fd.set('caseId', caseId);
                  fd.set('reason', cancelReason || 'Order cancelled before dispatch.');
                  wrap(() => handleCancelBilling(fd));
                }}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
                    {isPending ? 'Cancelling…' : 'Confirm Cancel'}
                  </Button>
                </form>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCancel(false)}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
