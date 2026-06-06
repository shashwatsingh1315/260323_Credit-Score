"use client";
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ShieldAlert, ArrowUpRight, Search, FileText,
  MessageSquare, IndianRupee, Phone, TrendingUp,
  Clock, ChevronDown, Filter, X, Users, ExternalLink,
  CheckSquare, Plus,
} from 'lucide-react';
import { handleEscalateCase, bulkAssignRMs, addHqCollectionLog } from './actions';
import { handleLogPayment } from '@/app/cases/[id]/billing-actions';
import { SubmitButton } from '@/components/ui/submit-button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
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
  escalations?: { id: string; status: string; ptp_date: string | null; level: number; tranche_index: number }[];
}

interface Stats {
  totalOverdue: number;
  countOverdue: number;
  highRiskAmt: number;
  highRiskCount: number;
  ptpDueTodayCount: number;
  recovered7d: number;
  recoveredCount7d: number;
  buckets: Record<string, number>;
  bucketAmts: Record<string, number>;
  untouched14dCount: number;
}

type View = 'all' | '90plus' | 'ptp' | 'untouched' | 'escalated';
type SortKey = 'overdue_days' | 'outstanding' | 'name';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatINR = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
const formatCompactINR = (n: number) => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${n}`;
};

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

function computeOverdueTranches(c: Case) {
  if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) return [];
  const billingDate = new Date(c.billing_date);
  const billAmt = c.decided_bill_amount;
  let remaining = c.actual_bill_amount ?? 0;
  const now = new Date();
  const result: { trancheIndex: number; expectedAmount: number; paidAmount: number; dueDate: Date; daysOverdue: number; outstanding: number }[] = [];
  for (let i = 0; i < c.proposed_tranches.length; i++) {
    const t = c.proposed_tranches[i];
    const amt = t.type === 'percentage' ? Math.round((t.value / 100) * billAmt) : Math.round(t.value);
    const fill = Math.min(remaining, amt);
    remaining -= fill;
    const unpaid = amt - fill;
    if (unpaid > 0) {
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86400000);
      if (daysOverdue > 0) {
        result.push({ trancheIndex: i, expectedAmount: amt, paidAmount: fill, dueDate: due, daysOverdue, outstanding: unpaid });
      }
    }
  }
  return result;
}

function getWorstDpd(c: Case): number {
  return Math.max(0, ...computeOverdueTranches(c).map(t => t.daysOverdue));
}

function getOutstanding(c: Case): number {
  return Math.max(0, (c.decided_bill_amount || c.bill_amount || 0) - (c.actual_bill_amount ?? 0));
}

function getDpdBand(days: number): 'soft' | 'mid' | 'hard' | 'critical' {
  if (days <= 30) return 'soft';
  if (days <= 60) return 'mid';
  if (days <= 90) return 'hard';
  return 'critical';
}

// Single-hue amber severity ladder. Intensity = severity, not hue.
const bandStyles: Record<string, { strip: string; pill: string; label: string }> = {
  soft:     { strip: 'bg-amber-300', pill: 'bg-amber-100 text-amber-900 border-amber-200', label: '1–30d' },
  mid:      { strip: 'bg-amber-500', pill: 'bg-amber-200 text-amber-900 border-amber-300', label: '31–60d' },
  hard:     { strip: 'bg-amber-700', pill: 'bg-amber-300 text-amber-950 border-amber-400', label: '61–90d' },
  critical: { strip: 'bg-amber-900', pill: 'bg-amber-400 text-amber-950 border-amber-500', label: '90d+' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CollectionsClient({
  collections, stats, escalations, rms = [], hqLogs = [], currentRole = 'viewer',
}: {
  collections: Case[];
  stats: Stats;
  escalations: any[];
  rms?: { id: string; full_name: string }[];
  hqLogs?: any[];
  currentRole?: string;
}) {
  const isAccounts = currentRole === 'accounts';
  const canEscalate = ['rm', 'kam', 'founder_admin'].includes(currentRole);
  const canHqChat   = ['kam', 'founder_admin'].includes(currentRole);
  const canBulkAssign = ['kam', 'founder_admin'].includes(currentRole);

  // ── State ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('all');
  const [sortBy, setSortBy] = useState<SortKey>('overdue_days');
  const [filterRm, setFilterRm] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [selectedRm, setSelectedRm] = useState('');

  const [chatOpenForCase, setChatOpenForCase] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');

  // Inline payment form (scoped per-card via expandedCaseId)
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const todayIso = new Date().toISOString().slice(0, 10);

  // Build a per-case last-contact lookup
  const lastContactByCase = useMemo(() => {
    const m = new Map<string, number>();
    for (const log of hqLogs) {
      const t = new Date(log.created_at).getTime();
      const prev = m.get(log.case_id);
      if (prev === undefined || t > prev) m.set(log.case_id, t);
    }
    return m;
  }, [hqLogs]);

  const daysSinceLastContact = (caseId: string): number | null => {
    const t = lastContactByCase.get(caseId);
    if (t === undefined) return null;
    return Math.floor((Date.now() - t) / 86400000);
  };

  const hasPtpDueToday = (c: Case): boolean =>
    (c.escalations || []).some(e => e.status === 'snoozed' && e.ptp_date === todayIso);

  // Reset payment fields when expanding a new case
  useEffect(() => {
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentError('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  }, [expandedCaseId]);

  // ── Filter / sort pipeline ──────────────────────────────────────────────
  const uniqueRms = useMemo(
    () => Array.from(new Set(collections.map(getRmName))).sort(),
    [collections]
  );

  const filtered = useMemo(() => {
    return collections.filter(c => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const hit = getCustomerName(c).toLowerCase().includes(q)
          || c.case_number?.toLowerCase().includes(q)
          || c.id.includes(search)
          || getRmName(c).toLowerCase().includes(q);
        if (!hit) return false;
      }

      // View (quick filter chip)
      if (view === '90plus' && getWorstDpd(c) <= 90) return false;
      if (view === 'ptp' && !hasPtpDueToday(c)) return false;
      if (view === 'untouched') {
        const d = daysSinceLastContact(c.id);
        if (d !== null && d < 14) return false;
      }
      if (view === 'escalated' && (c.escalation_level ?? 0) === 0) return false;

      // Advanced
      if (filterRm !== 'all' && getRmName(c) !== filterRm) return false;

      return true;
    });
    // hqLogs feeds daysSinceLastContact via lastContactByCase; todayIso pins PTP comparison.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, search, view, filterRm, lastContactByCase, todayIso]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortBy === 'overdue_days') return getWorstDpd(b) - getWorstDpd(a);
      if (sortBy === 'outstanding') return getOutstanding(b) - getOutstanding(a);
      return getCustomerName(a).localeCompare(getCustomerName(b));
    });
    return arr;
  }, [filtered, sortBy]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const toggleSelection = (id: string) => {
    const next = new Set(selectedCaseIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCaseIds(next);
  };

  const submitInlinePayment = async (caseId: string) => {
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
      setExpandedCaseId(null);
    } catch (e: any) {
      setPaymentError(e.message);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // ── Render: aging bar ──────────────────────────────────────────────────
  const totalBucketCount = Object.values(stats.buckets).reduce((s, n) => s + n, 0) || 1;
  const bucketBar = ['1-30', '31-60', '61-90', '90+'].map(key => {
    const count = stats.buckets[key] || 0;
    const pct = (count / totalBucketCount) * 100;
    const band = key === '1-30' ? 'soft' : key === '31-60' ? 'mid' : key === '61-90' ? 'hard' : 'critical';
    return { key, count, pct, amt: stats.bucketAmts[key] || 0, band };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Collections</h1>
          <p className="text-sm text-muted-foreground">
            {isAccounts
              ? 'Review outstanding dues and record incoming payments.'
              : 'Triage overdue cases, log contact, and drive recovery.'}
          </p>
        </div>
        {canBulkAssign && (
          <Link
            href="/admin/imports?type=grandfathered_cases"
            className="shrink-0"
            title="Import legacy outstanding cases via CSV"
          >
            <Button variant="outline" size="sm" className="border-amber-400 text-amber-900 hover:bg-amber-50">
              <Plus size={14} className="mr-1.5" /> Add legacy case
            </Button>
          </Link>
        )}
      </div>

      {/* Stat strip — 5 compact metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile
          icon={<IndianRupee size={14} />}
          label="Outstanding"
          value={formatCompactINR(stats.totalOverdue)}
          sublabel={`${stats.countOverdue} case${stats.countOverdue !== 1 ? 's' : ''}`}
          tone="neutral"
        />
        <StatTile
          icon={<ShieldAlert size={14} />}
          label="90+ DPD"
          value={formatCompactINR(stats.highRiskAmt)}
          sublabel={`${stats.highRiskCount} high-risk`}
          tone="severe"
        />
        <StatTile
          icon={<Phone size={14} />}
          label="PTP Due Today"
          value={`${stats.ptpDueTodayCount}`}
          sublabel="follow up"
          tone="neutral"
        />
        <StatTile
          icon={<Clock size={14} />}
          label="Untouched 14d+"
          value={`${stats.untouched14dCount}`}
          sublabel="needs contact"
          tone="warn"
        />
        <StatTile
          icon={<TrendingUp size={14} />}
          label="Recovered 7d"
          value={formatCompactINR(stats.recovered7d)}
          sublabel={`${stats.recoveredCount7d} payment${stats.recoveredCount7d !== 1 ? 's' : ''}`}
          tone="success"
        />
      </div>

      {/* Aging bucket bar */}
      {stats.countOverdue > 0 && (
        <Card className="border-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aging distribution</p>
              <p className="text-xs text-muted-foreground">{stats.countOverdue} overdue cases</p>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              {bucketBar.map(b => b.pct > 0 && (
                <div
                  key={b.key}
                  className={bandStyles[b.band].strip}
                  style={{ width: `${b.pct}%` }}
                  title={`${b.key} days: ${b.count} cases (${formatCompactINR(b.amt)})`}
                />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
              {bucketBar.map(b => (
                <div key={b.key} className="flex items-baseline gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-sm ${bandStyles[b.band].strip}`} />
                  <span className="text-muted-foreground">{b.key}d</span>
                  <span className="font-semibold ml-auto">{b.count}</span>
                  <span className="text-muted-foreground">· {formatCompactINR(b.amt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter row: search + chips + advanced toggle */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search customer, case# or RM…"
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={view === 'all'}     onClick={() => setView('all')}>All</FilterChip>
            <FilterChip active={view === '90plus'}  onClick={() => setView('90plus')} tone="severe">90+ DPD</FilterChip>
            <FilterChip active={view === 'ptp'}     onClick={() => setView('ptp')}>PTP today</FilterChip>
            <FilterChip active={view === 'untouched'} onClick={() => setView('untouched')} tone="warn">Untouched 14d+</FilterChip>
            <FilterChip active={view === 'escalated'} onClick={() => setView('escalated')} tone="severe">Escalated</FilterChip>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="md:ml-auto h-9 text-xs"
            onClick={() => setShowAdvanced(s => !s)}
          >
            <Filter size={14} className="mr-1.5" />
            {showAdvanced ? 'Hide' : 'More'} filters
            <ChevronDown size={14} className={`ml-1 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {showAdvanced && (
          <div className="flex flex-wrap items-end gap-3 bg-muted/30 border rounded-md p-3">
            <div className="flex flex-col gap-1">
              <label className="text-tiny uppercase font-bold text-muted-foreground">RM</label>
              <select value={filterRm} onChange={e => setFilterRm(e.target.value)} className="text-sm border rounded px-2 py-1 h-8 bg-background min-w-36">
                <option value="all">All RMs</option>
                {uniqueRms.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-tiny uppercase font-bold text-muted-foreground">Sort by</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="text-sm border rounded px-2 py-1 h-8 bg-background">
                <option value="overdue_days">Most overdue first</option>
                <option value="outstanding">Largest amount</option>
                <option value="name">Customer name (A→Z)</option>
              </select>
            </div>
            {(filterRm !== 'all' || sortBy !== 'overdue_days') && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterRm('all'); setSortBy('overdue_days'); }}>
                <X size={12} className="mr-1" /> Reset
              </Button>
            )}
          </div>
        )}

        {(view !== 'all' || search || filterRm !== 'all') && (
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{sorted.length}</span> of {collections.length} overdue cases
          </p>
        )}
      </div>

      {/* Case list */}
      <div className="space-y-2">
        {sorted.length === 0 ? (
          <Card className="py-12 border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText size={24} className="text-muted-foreground" />
              </div>
              <p className="text-base font-semibold">Nothing to show</p>
              <p className="text-sm text-muted-foreground">No overdue cases match your filters.</p>
            </CardContent>
          </Card>
        ) : (
          sorted.map(c => (
            <CaseRow
              key={c.id}
              c={c}
              expanded={expandedCaseId === c.id}
              onToggleExpand={() => setExpandedCaseId(expandedCaseId === c.id ? null : c.id)}
              selected={selectedCaseIds.has(c.id)}
              onToggleSelect={() => toggleSelection(c.id)}
              showSelect={canBulkAssign}
              canEscalate={canEscalate}
              canHqChat={canHqChat}
              daysSinceLastContact={daysSinceLastContact(c.id)}
              hasPtpToday={hasPtpDueToday(c)}
              escalations={escalations}
              hqLogs={hqLogs.filter(l => l.case_id === c.id)}
              onOpenChat={() => setChatOpenForCase(c.id)}
              paymentAmount={paymentAmount}
              paymentDate={paymentDate}
              paymentNote={paymentNote}
              paymentSubmitting={paymentSubmitting}
              paymentError={paymentError}
              onPaymentAmount={setPaymentAmount}
              onPaymentDate={setPaymentDate}
              onPaymentNote={setPaymentNote}
              onSubmitPayment={submitInlinePayment}
            />
          ))
        )}
      </div>

      {/* Floating bulk-action bar */}
      {selectedCaseIds.size > 0 && canBulkAssign && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-background border shadow-lg rounded-full px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium flex items-center gap-2">
            <CheckSquare size={14} className="text-primary" />
            {selectedCaseIds.size} selected
          </span>
          <div className="w-px h-5 bg-border" />
          <form action={bulkAssignRMs} className="flex items-center gap-2">
            <input type="hidden" name="caseIds" value={JSON.stringify(Array.from(selectedCaseIds))} />
            <select name="rmId" value={selectedRm} onChange={e => setSelectedRm(e.target.value)} className="text-sm border rounded px-2 py-1 h-8 bg-background" required>
              <option value="">Assign to RM…</option>
              {rms.map(rm => <option key={rm.id} value={rm.id}>{rm.full_name}</option>)}
            </select>
            <SubmitButton type="submit" size="sm" disabled={!selectedRm}>
              <Users size={13} className="mr-1.5" /> Assign
            </SubmitButton>
          </form>
          <button
            type="button"
            onClick={() => setSelectedCaseIds(new Set())}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* HQ Chat side drawer */}
      {chatOpenForCase && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setChatOpenForCase(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="font-semibold text-sm">HQ Contact Log</h3>
                <p className="text-xs text-muted-foreground">
                  {getCustomerName(collections.find(c => c.id === chatOpenForCase)!)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setChatOpenForCase(null)}>
                <X size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {hqLogs.filter(l => l.case_id === chatOpenForCase).length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare size={32} className="mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Be the first to log a call or note.</p>
                </div>
              ) : (
                hqLogs.filter(l => l.case_id === chatOpenForCase).map(log => (
                  <div key={log.id} className="bg-muted/40 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start mb-1.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{log.logged_by_user?.full_name || 'System'}</span>
                      <span>{new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{log.message}</p>
                  </div>
                ))
              )}
            </div>
            <form
              action={addHqCollectionLog}
              className="border-t p-3 bg-muted/20 flex gap-2"
              onSubmit={() => setTimeout(() => setChatMessage(''), 100)}
            >
              <input type="hidden" name="caseId" value={chatOpenForCase} />
              <Input
                name="message"
                placeholder="Log a call or remark…"
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                required
                autoComplete="off"
              />
              <SubmitButton type="submit" size="sm">Log</SubmitButton>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────
// Tones use only: neutral grayscale, amber severity ladder, and one emerald positive accent.
const toneClasses: Record<string, { bg: string; text: string; icon: string }> = {
  neutral: { bg: 'bg-card',     text: 'text-foreground', icon: 'text-muted-foreground' },
  severe:  { bg: 'bg-amber-50', text: 'text-amber-900',  icon: 'text-amber-700' },
  warn:    { bg: 'bg-amber-50', text: 'text-amber-900',  icon: 'text-amber-600' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-900', icon: 'text-emerald-600' },
};

function StatTile({ icon, label, value, sublabel, tone = 'neutral' }: {
  icon: React.ReactNode; label: string; value: string; sublabel: string; tone?: keyof typeof toneClasses;
}) {
  const t = toneClasses[tone];
  return (
    <Card className={`${t.bg} border-muted/50`}>
      <CardContent className="p-3">
        <div className={`flex items-center gap-1.5 ${t.icon} mb-1`}>
          {icon}
          <span className="text-tiny font-bold uppercase tracking-wider">{label}</span>
        </div>
        <p className={`text-xl font-bold leading-tight ${t.text}`}>{value}</p>
        <p className="text-tiny text-muted-foreground mt-0.5">{sublabel}</p>
      </CardContent>
    </Card>
  );
}

function FilterChip({ active, onClick, children, tone }: {
  active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'severe' | 'warn';
}) {
  const inactiveBase = 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted/60';
  const activeMap = {
    severe: 'bg-amber-100 border-amber-400 text-amber-900',
    warn: 'bg-amber-100 border-amber-300 text-amber-900',
    default: 'bg-primary/10 border-primary/30 text-primary',
  };
  const activeCls = active ? activeMap[tone || 'default'] : inactiveBase;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${activeCls}`}
    >
      {children}
    </button>
  );
}

function CaseRow(props: {
  c: Case;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  showSelect: boolean;
  canEscalate: boolean;
  canHqChat: boolean;
  daysSinceLastContact: number | null;
  hasPtpToday: boolean;
  escalations: any[];
  hqLogs: any[];
  onOpenChat: () => void;
  paymentAmount: string;
  paymentDate: string;
  paymentNote: string;
  paymentSubmitting: boolean;
  paymentError: string;
  onPaymentAmount: (v: string) => void;
  onPaymentDate: (v: string) => void;
  onPaymentNote: (v: string) => void;
  onSubmitPayment: (caseId: string) => void;
}) {
  const {
    c, expanded, onToggleExpand, selected, onToggleSelect, showSelect,
    canEscalate, canHqChat, daysSinceLastContact, hasPtpToday,
    escalations, hqLogs, onOpenChat,
    paymentAmount, paymentDate, paymentNote, paymentSubmitting, paymentError,
    onPaymentAmount, onPaymentDate, onPaymentNote, onSubmitPayment,
  } = props;

  const overdueDays = getWorstDpd(c);
  const outstanding = getOutstanding(c);
  const billed = c.decided_bill_amount || c.bill_amount || 0;
  const collected = c.actual_bill_amount || 0;
  const collectedPct = billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0;
  const band = getDpdBand(overdueDays);
  const isEscalated = (c.escalation_level ?? 0) > 0;
  const nextLevel = (c.escalation_level ?? 0) + 1;
  const targetRole = escalations.find(e => e.escalation_level === nextLevel)?.escalate_to_role || 'founder_admin';
  const overdueTranches = computeOverdueTranches(c);
  const worstTranche = overdueTranches.sort((a, b) => b.daysOverdue - a.daysOverdue)[0];

  return (
    <Card className="overflow-hidden border-border hover:border-foreground/20 transition-colors">
      <div className="flex">
        {/* Severity strip */}
        <div className={`w-1 shrink-0 ${bandStyles[band].strip}`} />

        <div className="flex-1 min-w-0">
          {/* Collapsed row */}
          <div
            className="p-3 sm:p-4 flex items-center gap-3 cursor-pointer"
            onClick={onToggleExpand}
          >
            {showSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 cursor-pointer shrink-0"
                aria-label="Select case"
              />
            )}

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm sm:text-base truncate">{getCustomerName(c)}</h3>
                <span className={`text-tiny font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${bandStyles[band].pill}`}>
                  {overdueDays}d
                </span>
                {isEscalated && (
                  <span className="text-tiny font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider bg-amber-200 text-amber-900 border-amber-300">
                    L{c.escalation_level}
                  </span>
                )}
                {hasPtpToday && (
                  <span className="text-tiny font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 uppercase tracking-wider">
                    PTP today
                  </span>
                )}
                {(c.case_attributes?.grandfathered || c.case_attributes?.imported) && (
                  <span
                    className="text-tiny font-semibold text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 uppercase tracking-wider"
                    title="Imported from legacy system — no scoring history"
                  >
                    Legacy
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                <Link
                  href={`/cases/${c.id}`}
                  className="font-mono hover:text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  {c.case_number || c.id.split('-')[0]}
                </Link>
                <span>·</span>
                <span>RM: <span className="text-foreground">{getRmName(c)}</span></span>
                {daysSinceLastContact !== null ? (
                  <>
                    <span>·</span>
                    <span className={daysSinceLastContact >= 14 ? 'text-amber-700 font-medium' : ''}>
                      Last contact: {daysSinceLastContact}d ago
                    </span>
                  </>
                ) : (
                  <>
                    <span>·</span>
                    <span className="text-amber-700 font-medium">No contact logged</span>
                  </>
                )}
              </div>
            </div>

            {/* Money block — right aligned */}
            <div className="text-right shrink-0">
              <p className="font-semibold text-sm sm:text-base tabular-nums">
                {formatINR(outstanding)}
              </p>
              <p className="text-tiny text-muted-foreground tabular-nums">
                {formatCompactINR(collected)} of {formatCompactINR(billed)} · {collectedPct}%
              </p>
            </div>

            {/* Primary action (role-aware) */}
            <Button
              size="sm"
              className="shrink-0 hidden sm:inline-flex"
              onClick={e => { e.stopPropagation(); if (!expanded) onToggleExpand(); }}
            >
              <IndianRupee size={13} className="mr-1" />
              Record payment
            </Button>

            <ChevronDown
              size={16}
              className={`text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>

          {/* Expanded panel */}
          {expanded && (
            <div className="border-t bg-muted/20 px-3 sm:px-4 py-4 space-y-4">
              {(c.case_attributes?.grandfathered || c.case_attributes?.imported) && (
                <p className="text-xs text-muted-foreground italic">
                  No scoring trail — this case was grandfathered from a legacy system.
                </p>
              )}
              {/* Tranche breakdown */}
              {overdueTranches.length > 0 && (
                <div>
                  <p className="text-tiny uppercase font-bold tracking-wider text-muted-foreground mb-2">
                    Overdue tranches
                  </p>
                  <div className="rounded-md border bg-background overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Due date</th>
                          <th className="px-3 py-2 font-medium text-right">Expected</th>
                          <th className="px-3 py-2 font-medium text-right">Paid</th>
                          <th className="px-3 py-2 font-medium text-right">Outstanding</th>
                          <th className="px-3 py-2 font-medium text-right">DPD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overdueTranches.map(t => (
                          <tr key={t.trancheIndex} className="border-t">
                            <td className="px-3 py-2 font-mono">T{t.trancheIndex + 1}</td>
                            <td className="px-3 py-2">{t.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatINR(t.expectedAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatINR(t.paidAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatINR(t.outstanding)}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={`text-tiny font-bold px-1.5 py-0.5 rounded border ${bandStyles[getDpdBand(t.daysOverdue)].pill}`}>
                                {t.daysOverdue}d
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {c.billing_date && (
                    <p className="text-tiny text-muted-foreground mt-2">
                      Billing date: {new Date(c.billing_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' · '}Credit terms: {c.composite_credit_days || 0} days
                    </p>
                  )}
                </div>
              )}

              {/* Two-column layout: payment form + recent contact */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Inline payment form — prominent for accounts */}
                <div className="rounded-md border bg-background p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <IndianRupee size={14} className="text-emerald-700" />
                    <p className="text-xs font-semibold">Record payment</p>
                    {worstTranche && (
                      <span className="text-tiny text-muted-foreground ml-auto">
                        applies to T{worstTranche.trancheIndex + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Amount ₹"
                      value={paymentAmount}
                      onChange={e => onPaymentAmount(e.target.value)}
                      className="flex-1 border rounded px-2 py-1.5 text-sm bg-background"
                    />
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={e => onPaymentDate(e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm bg-background"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Reference / note (optional)"
                    value={paymentNote}
                    onChange={e => onPaymentNote(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  />
                  {paymentError && <p className="text-xs text-destructive">{paymentError}</p>}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-800"
                      onClick={() => onSubmitPayment(c.id)}
                      disabled={!paymentAmount || paymentSubmitting}
                    >
                      {paymentSubmitting ? 'Saving…' : 'Save payment'}
                    </Button>
                    {worstTranche && (
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => onPaymentAmount(worstTranche.outstanding.toString())}
                      >
                        Fill {formatINR(worstTranche.outstanding)}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Recent HQ activity preview */}
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-muted-foreground" />
                      <p className="text-xs font-semibold">Recent contact</p>
                    </div>
                    {canHqChat && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onOpenChat}>
                        Open log <ExternalLink size={11} className="ml-1" />
                      </Button>
                    )}
                  </div>
                  {hqLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No interactions logged yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {hqLogs.slice(-2).reverse().map(log => (
                        <div key={log.id} className="text-xs">
                          <div className="flex justify-between text-muted-foreground text-tiny mb-0.5">
                            <span className="font-semibold text-foreground">{log.logged_by_user?.full_name || 'System'}</span>
                            <span>{new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                          </div>
                          <p className="line-clamp-2">{log.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Secondary actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link href={`/cases/${c.id}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink size={13} className="mr-1.5" /> Open case
                  </Button>
                </Link>
                {canEscalate && (
                  <form action={handleEscalateCase}>
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="trancheIndex" value={worstTranche?.trancheIndex ?? 0} />
                    <input type="hidden" name="targetRole" value={targetRole} />
                    <SubmitButton
                      type="submit"
                      variant="outline"
                      size="sm"
                      className={isEscalated ? "border-amber-500 text-amber-900 hover:bg-amber-50" : ""}
                      loadingText="Escalating…"
                    >
                      <ArrowUpRight size={13} className="mr-1.5" />
                      {isEscalated ? `Escalate to L${Math.min(3, nextLevel)}` : 'Escalate'}
                    </SubmitButton>
                  </form>
                )}
                {canHqChat && (
                  <Button variant="outline" size="sm" onClick={onOpenChat}>
                    <MessageSquare size={13} className="mr-1.5" /> HQ contact log
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
