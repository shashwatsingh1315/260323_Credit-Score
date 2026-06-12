"use client";
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ShieldAlert, ArrowUpRight, Search, FileText,
  MessageSquare, IndianRupee, Phone, TrendingUp,
  Clock, ChevronDown, ChevronLeft, ChevronRight, X, Users, ExternalLink,
  CheckSquare, Plus, LayoutGrid, List as ListIcon, CalendarClock,
  AlertTriangle, MapPin, Building2,
} from 'lucide-react';
import { handleEscalateCase, bulkAssignRMs, addHqCollectionLog, setBoardStatus } from './actions';
import { handleLogPayment } from '@/app/cases/[id]/billing-actions';
import { SubmitButton } from '@/components/ui/submit-button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Party { legal_name: string }

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
  contractor_party_id?: string | null;
  customer_party_id?: string | null;
  customer?: Party[] | Party | null;
  contractor?: Party[] | Party | null;
  rm?: { full_name: string }[] | { full_name: string } | null;
  case_attributes?: any;
  escalations?: { id: string; status: string; ptp_date: string | null; level: number; tranche_index: number }[];
}

interface RelatedCase {
  id: string;
  case_number: string;
  status: string;
  bill_amount: number;
  decided_bill_amount?: number | null;
  actual_bill_amount?: number | null;
  billing_date?: string | null;
  proposed_tranches?: any;
  composite_credit_days?: number;
  contractor_party_id?: string | null;
  customer_party_id?: string | null;
  customer?: Party[] | Party | null;
}

interface Repayment { amount: number; payment_date: string; case_id: string }

type View = 'all' | 'ptp' | 'broken' | 'untouched' | 'escalated';
type SortKey = 'overdue_days' | 'outstanding' | 'name';
type BucketKey = '1-30' | '31-60' | '61-90' | '90+';
type BoardCol = 'backlog' | 'today' | 'working' | 'done';
type ViewMode = 'list' | 'board';

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

// Business runs on IST — pin "today" to Asia/Kolkata on both client and server.
const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const partyName = (p: Party[] | Party | null | undefined): string | null => {
  if (!p) return null;
  if (Array.isArray(p)) return p[0]?.legal_name || null;
  return p.legal_name || null;
};

function getCustomerName(c: Case): string {
  return partyName(c.customer) || '—';
}

function getRmName(c: Case): string {
  const original = (c.case_attributes as any)?.original_rm_name;
  if (original) return original;
  if (!c.rm) return 'Unassigned';
  if (Array.isArray(c.rm)) return c.rm[0]?.full_name || 'Unassigned';
  return c.rm.full_name || 'Unassigned';
}

// Auto-generated import IDs like "GF-f8e0d478" are noise — hide them.
function displayCaseNumber(c: { case_number?: string }): string | null {
  const n = c.case_number;
  if (!n) return null;
  if (/^[A-Z]{1,4}-[0-9a-f]{6,}$/i.test(n)) return null;
  return n;
}

function computeOverdueTranches(c: { billing_date?: string | null; proposed_tranches?: any; decided_bill_amount?: number | null; actual_bill_amount?: number | null }) {
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

function getOutstanding(c: { decided_bill_amount?: number | null; bill_amount?: number; actual_bill_amount?: number | null }): number {
  return Math.max(0, (c.decided_bill_amount || c.bill_amount || 0) - (c.actual_bill_amount ?? 0));
}

function getBucket(days: number): BucketKey {
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

// Severity ladder: neutral → amber → red. Only 90+ shouts.
const bucketStyles: Record<BucketKey, { strip: string; pill: string; label: string }> = {
  '1-30':  { strip: 'bg-zinc-300 dark:bg-zinc-600',  pill: 'bg-muted text-muted-foreground border-border', label: '1–30 days' },
  '31-60': { strip: 'bg-amber-400', pill: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900', label: '31–60 days' },
  '61-90': { strip: 'bg-amber-600', pill: 'bg-amber-200 text-amber-950 border-amber-300 dark:bg-amber-900/50 dark:text-amber-100 dark:border-amber-800', label: '61–90 days' },
  '90+':   { strip: 'bg-red-600',   pill: 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900', label: 'Critical · 90+ days' },
};

// Structured log parsing: "[call] text\n[PTP 2026-06-20 ₹50,000]"
function parseLog(message: string): { type: 'call' | 'visit' | 'note'; text: string; ptp: { date: string; amount: number | null } | null } {
  let text = message || '';
  let type: 'call' | 'visit' | 'note' = 'note';
  const typeMatch = text.match(/^\[(call|visit)\]\s*/i);
  if (typeMatch) {
    type = typeMatch[1].toLowerCase() as 'call' | 'visit';
    text = text.slice(typeMatch[0].length);
  }
  let ptp: { date: string; amount: number | null } | null = null;
  const ptpMatch = text.match(/\n?\[PTP (\d{4}-\d{2}-\d{2})(?:\s*₹([\d,]+))?\]\s*$/);
  if (ptpMatch) {
    ptp = { date: ptpMatch[1], amount: ptpMatch[2] ? parseInt(ptpMatch[2].replace(/,/g, ''), 10) : null };
    text = text.slice(0, ptpMatch.index).trim();
  }
  return { type, text, ptp };
}

const shortDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

interface Derived {
  worstDpd: number;
  outstanding: number;
  billed: number;
  collected: number;
  collectedPct: number;
  bucket: BucketKey;
  overdueTranches: ReturnType<typeof computeOverdueTranches>;
  customerName: string;
  contractorName: string | null;
  rmName: string;
  caseNo: string | null;
  isLegacy: boolean;
  activePtp: { date: string; amount: number | null } | null;
  brokenPtp: { date: string; amount: number | null } | null;
  lastContactDays: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CollectionsClient({
  collections, escalations, rms = [], hqLogs = [], relatedCases = [], repayments7d = [], currentRole = 'viewer',
}: {
  collections: Case[];
  escalations: any[];
  rms?: { id: string; full_name: string }[];
  hqLogs?: any[];
  relatedCases?: RelatedCase[];
  repayments7d?: Repayment[];
  currentRole?: string;
}) {
  const canLogPayment = ['kam', 'accounts', 'founder_admin'].includes(currentRole);
  const canEscalate = ['rm', 'kam', 'founder_admin'].includes(currentRole);
  const canHqChat   = ['kam', 'founder_admin'].includes(currentRole);
  const canBulkAssign = ['kam', 'founder_admin'].includes(currentRole);

  // ── State ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('all');
  const [bucketFilter, setBucketFilter] = useState<BucketKey | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('overdue_days');
  const [filterRm, setFilterRm] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [selectedRm, setSelectedRm] = useState('');
  const [chatOpenForCase, setChatOpenForCase] = useState<string | null>(null);

  // Optimistic board moves (caseId → column), reconciled by revalidation.
  const [boardOverrides, setBoardOverrides] = useState<Record<string, BoardCol>>({});

  const todayIso = istToday();

  // Filters live in the URL — views are shareable and survive refresh.
  const didInitFromUrl = useRef(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get('q'); if (q) setSearch(q);
    const v = p.get('view'); if (v && ['ptp', 'broken', 'untouched', 'escalated'].includes(v)) setView(v as View);
    const b = p.get('band'); if (b && ['1-30', '31-60', '61-90', '90+'].includes(b)) setBucketFilter(b as BucketKey);
    const rm = p.get('rm'); if (rm) setFilterRm(rm);
    const s = p.get('sort'); if (s && ['overdue_days', 'outstanding', 'name'].includes(s)) setSortBy(s as SortKey);
    const m = p.get('mode');
    if (m === 'board' || m === 'list') {
      setViewMode(m);
    } else {
      const stored = window.localStorage.getItem('collections:viewMode');
      if (stored === 'board' || stored === 'list') setViewMode(stored);
    }
    didInitFromUrl.current = true;
  }, []);

  useEffect(() => {
    if (!didInitFromUrl.current) return;
    const p = new URLSearchParams();
    if (search) p.set('q', search);
    if (view !== 'all') p.set('view', view);
    if (bucketFilter) p.set('band', bucketFilter);
    if (filterRm !== 'all') p.set('rm', filterRm);
    if (sortBy !== 'overdue_days') p.set('sort', sortBy);
    if (viewMode !== 'list') p.set('mode', viewMode);
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [search, view, bucketFilter, filterRm, sortBy, viewMode]);

  const switchViewMode = (m: ViewMode) => {
    setViewMode(m);
    window.localStorage.setItem('collections:viewMode', m);
  };

  // ── Derived per-case data (computed once, not per keystroke) ────────────
  const derivedById = useMemo(() => {
    // Latest contact + latest PTP marker per case from logs
    const lastContact = new Map<string, number>();
    const latestPtpMarker = new Map<string, { date: string; amount: number | null }>();
    for (const log of hqLogs) {
      const t = new Date(log.created_at).getTime();
      const prev = lastContact.get(log.case_id);
      if (prev === undefined || t > prev) lastContact.set(log.case_id, t);
      const { ptp } = parseLog(log.message);
      if (ptp) latestPtpMarker.set(log.case_id, ptp); // logs arrive oldest→newest
    }

    const map = new Map<string, Derived>();
    for (const c of collections) {
      const overdueTranches = computeOverdueTranches(c);
      const worstDpd = Math.max(0, ...overdueTranches.map(t => t.daysOverdue));
      const outstanding = getOutstanding(c);
      const billed = c.decided_bill_amount || c.bill_amount || 0;
      const collected = c.actual_bill_amount || 0;
      const marker = latestPtpMarker.get(c.id) || null;

      // Active PTP: the snoozed escalation is the source of truth; the log
      // marker contributes the promised amount (and acts as fallback).
      const snoozed = (c.escalations || []).find(e => e.status === 'snoozed' && e.ptp_date && e.ptp_date >= todayIso);
      let activePtp: Derived['activePtp'] = null;
      if (snoozed?.ptp_date) {
        activePtp = { date: snoozed.ptp_date, amount: marker?.date === snoozed.ptp_date ? marker.amount : null };
      } else if (marker && marker.date >= todayIso) {
        activePtp = marker;
      }

      // Broken promise: latest recorded PTP slipped past, money still due,
      // and no fresh promise on file. (refresh_ptp_statuses wipes ptp_date
      // on the escalation, so the log marker is the durable record.)
      const brokenPtp = !activePtp && marker && marker.date < todayIso && outstanding > 0 ? marker : null;

      const lastT = lastContact.get(c.id);
      const contractorName = partyName(c.contractor);
      const customerName = getCustomerName(c);

      map.set(c.id, {
        worstDpd,
        outstanding,
        billed,
        collected,
        collectedPct: billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0,
        bucket: getBucket(worstDpd),
        overdueTranches,
        customerName,
        contractorName: contractorName && contractorName !== customerName ? contractorName : null,
        rmName: getRmName(c),
        caseNo: displayCaseNumber(c),
        isLegacy: !!(c.case_attributes?.grandfathered || c.case_attributes?.imported),
        activePtp,
        brokenPtp,
        lastContactDays: lastT === undefined ? null : Math.floor((Date.now() - lastT) / 86400000),
      });
    }
    return map;
  }, [collections, hqLogs, todayIso]);

  const d = (c: Case): Derived => derivedById.get(c.id)!;

  // ── Filter / sort pipeline ──────────────────────────────────────────────
  const uniqueRms = useMemo(
    () => Array.from(new Set(collections.map(getRmName))).sort(),
    [collections]
  );

  // Everything except the bucket filter — feeds the aging bar.
  const baseFiltered = useMemo(() => {
    return collections.filter(c => {
      const dv = d(c);
      if (search) {
        const q = search.toLowerCase();
        const hit = dv.customerName.toLowerCase().includes(q)
          || (dv.contractorName || '').toLowerCase().includes(q)
          || (dv.caseNo || '').toLowerCase().includes(q)
          || dv.rmName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (view === 'ptp' && dv.activePtp?.date !== todayIso) return false;
      if (view === 'broken' && !dv.brokenPtp) return false;
      if (view === 'untouched' && dv.lastContactDays !== null && dv.lastContactDays < 14) return false;
      if (view === 'escalated' && (c.escalation_level ?? 0) === 0) return false;
      if (filterRm !== 'all' && dv.rmName !== filterRm) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, derivedById, search, view, filterRm, todayIso]);

  const sorted = useMemo(() => {
    const arr = baseFiltered.filter(c => !bucketFilter || d(c).bucket === bucketFilter);
    arr.sort((a, b) => {
      if (sortBy === 'overdue_days') return d(b).worstDpd - d(a).worstDpd;
      if (sortBy === 'outstanding') return d(b).outstanding - d(a).outstanding;
      return d(a).customerName.localeCompare(d(b).customerName);
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFiltered, bucketFilter, sortBy, derivedById]);

  // ── Stats — recomputed from the *visible* set so tiles follow filters ───
  const stats = useMemo(() => {
    const visibleIds = new Set(sorted.map(c => c.id));
    let totalOutstanding = 0, highRiskAmt = 0, highRiskCount = 0,
        ptpToday = 0, broken = 0, untouched = 0;
    for (const c of sorted) {
      const dv = d(c);
      totalOutstanding += dv.outstanding;
      if (dv.bucket === '90+') { highRiskAmt += dv.outstanding; highRiskCount++; }
      if (dv.activePtp?.date === todayIso) ptpToday++;
      if (dv.brokenPtp) broken++;
      if (dv.lastContactDays === null || dv.lastContactDays >= 14) untouched++;
    }
    const recov = repayments7d.filter(r => visibleIds.has(r.case_id));
    return {
      totalOutstanding,
      count: sorted.length,
      highRiskAmt, highRiskCount,
      ptpToday, broken, untouched,
      recovered7d: recov.reduce((s, r) => s + (r.amount || 0), 0),
      recoveredCount7d: recov.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, repayments7d, derivedById, todayIso]);

  // Aging bar from baseFiltered (bucket filter excluded so all bands stay visible)
  const agingBuckets = useMemo(() => {
    const counts: Record<BucketKey, number> = { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const amts: Record<BucketKey, number> = { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const c of baseFiltered) {
      const dv = d(c);
      counts[dv.bucket] += 1;
      amts[dv.bucket] += dv.outstanding;
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
    return (['1-30', '31-60', '61-90', '90+'] as BucketKey[]).map(key => ({
      key, count: counts[key], amt: amts[key], pct: (counts[key] / total) * 100,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFiltered, derivedById]);

  // Repayments received today — surfaced on board cards.
  const paidTodayByCase = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of repayments7d) {
      if (r.payment_date === todayIso) m.set(r.case_id, (m.get(r.case_id) || 0) + (r.amount || 0));
    }
    return m;
  }, [repayments7d, todayIso]);

  // ── Board helpers ───────────────────────────────────────────────────────
  const boardColOf = (c: Case): BoardCol => {
    const o = boardOverrides[c.id];
    if (o) return o;
    const b = c.case_attributes?.board;
    if (b && b.date === todayIso && ['today', 'working', 'done'].includes(b.status)) return b.status;
    return 'backlog';
  };

  const moveCard = async (caseId: string, col: BoardCol) => {
    const prev = boardOverrides[caseId];
    setBoardOverrides(o => ({ ...o, [caseId]: col }));
    try {
      await setBoardStatus(caseId, col);
    } catch (e: any) {
      setBoardOverrides(o => {
        const next = { ...o };
        if (prev) next[caseId] = prev; else delete next[caseId];
        return next;
      });
      alert(e?.message || 'Could not move case.');
    }
  };

  // ── Misc handlers ───────────────────────────────────────────────────────
  const toggleSelection = (id: string) => {
    const next = new Set(selectedCaseIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCaseIds(next);
  };

  const allVisibleSelected = sorted.length > 0 && sorted.every(c => selectedCaseIds.has(c.id));
  const toggleSelectAll = () => {
    setSelectedCaseIds(allVisibleSelected ? new Set() : new Set(sorted.map(c => c.id)));
  };

  const hasActiveFilters = view !== 'all' || !!search || filterRm !== 'all' || bucketFilter !== null;
  const clearFilters = () => { setView('all'); setSearch(''); setFilterRm('all'); setBucketFilter(null); };

  const chatCase = chatOpenForCase ? collections.find(c => c.id === chatOpenForCase) : null;

  // An RM only sees their own queue — repeating their name on every row is noise.
  const showRm = currentRole !== 'rm';

  const renderRow = (c: Case) => (
    <CaseRow
      key={c.id}
      c={c}
      dv={d(c)}
      expanded={expandedCaseId === c.id}
      onToggleExpand={() => setExpandedCaseId(expandedCaseId === c.id ? null : c.id)}
      selected={selectedCaseIds.has(c.id)}
      onToggleSelect={() => toggleSelection(c.id)}
      showSelect={canBulkAssign}
      showRm={showRm}
      canEscalate={canEscalate}
      canHqChat={canHqChat}
      canLogPayment={canLogPayment}
      escalationThresholds={escalations}
      hqLogs={hqLogs.filter(l => l.case_id === c.id)}
      relatedCases={relatedCases}
      onOpenChat={() => setChatOpenForCase(c.id)}
    />
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Collections</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === 'board'
              ? 'Pick your queue in the morning, work it through the day, review Done tonight.'
              : currentRole === 'accounts'
                ? 'Review outstanding dues and record incoming payments.'
                : 'Triage overdue cases, log contact, and drive recovery.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-md border overflow-hidden" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => switchViewMode('list')}
              className={`flex items-center gap-1.5 px-3 h-8 text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
              aria-pressed={viewMode === 'list'}
            >
              <ListIcon size={13} /> List
            </button>
            <button
              type="button"
              onClick={() => switchViewMode('board')}
              className={`flex items-center gap-1.5 px-3 h-8 text-xs font-medium transition-colors border-l ${viewMode === 'board' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
              aria-pressed={viewMode === 'board'}
            >
              <LayoutGrid size={13} /> Board
            </button>
          </div>
          {canBulkAssign && (
            <Link href="/admin/imports?type=grandfathered_cases" title="Import legacy outstanding cases via CSV">
              <Button variant="outline" size="sm">
                <Plus size={14} className="mr-1.5" /> Add legacy case
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stat tiles — live numbers for the current filter; most are tappable filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile
          icon={<IndianRupee size={14} />}
          label="Outstanding"
          value={formatCompactINR(stats.totalOutstanding)}
          sublabel={`${stats.count} case${stats.count !== 1 ? 's' : ''}${hasActiveFilters ? ' in view' : ''}`}
          active={false}
          onClick={hasActiveFilters ? clearFilters : undefined}
          hint={hasActiveFilters ? 'Clear all filters' : undefined}
        />
        <StatTile
          icon={<ShieldAlert size={14} />}
          label="90+ DPD"
          value={formatCompactINR(stats.highRiskAmt)}
          sublabel={`${stats.highRiskCount} high-risk`}
          tone="severe"
          active={bucketFilter === '90+'}
          onClick={() => setBucketFilter(b => b === '90+' ? null : '90+')}
        />
        <StatTile
          icon={<Phone size={14} />}
          label="PTP Today"
          value={`${stats.ptpToday}`}
          sublabel="promised to pay"
          active={view === 'ptp'}
          onClick={() => setView(v => v === 'ptp' ? 'all' : 'ptp')}
        />
        <StatTile
          icon={<AlertTriangle size={14} />}
          label="Broken PTP"
          value={`${stats.broken}`}
          sublabel="missed promises"
          tone={stats.broken > 0 ? 'severe' : 'neutral'}
          active={view === 'broken'}
          onClick={() => setView(v => v === 'broken' ? 'all' : 'broken')}
        />
        <StatTile
          icon={<Clock size={14} />}
          label="Untouched 14d+"
          value={`${stats.untouched}`}
          sublabel="needs contact"
          tone="warn"
          active={view === 'untouched'}
          onClick={() => setView(v => v === 'untouched' ? 'all' : 'untouched')}
        />
        <StatTile
          icon={<TrendingUp size={14} />}
          label="Recovered 7d"
          value={formatCompactINR(stats.recovered7d)}
          sublabel={`${stats.recoveredCount7d} payment${stats.recoveredCount7d !== 1 ? 's' : ''}`}
          tone="success"
          active={false}
        />
      </div>

      {/* Aging bar — segments are filters */}
      {baseFiltered.length > 0 && (
        <Card className="border-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aging</p>
              {bucketFilter ? (
                <button type="button" onClick={() => setBucketFilter(null)} className="text-xs text-primary hover:underline">
                  Showing {bucketFilter}d only — clear
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">{baseFiltered.length} overdue · tap a band to filter</p>
              )}
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              {agingBuckets.map(b => b.pct > 0 && (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBucketFilter(f => f === b.key ? null : b.key)}
                  className={`${bucketStyles[b.key].strip} transition-opacity ${bucketFilter && bucketFilter !== b.key ? 'opacity-30' : 'hover:opacity-80'}`}
                  style={{ width: `${b.pct}%` }}
                  title={`${b.key} days: ${b.count} cases (${formatCompactINR(b.amt)})`}
                  aria-label={`Filter to ${b.key} days overdue: ${b.count} cases`}
                  aria-pressed={bucketFilter === b.key}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
              {agingBuckets.map(b => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBucketFilter(f => f === b.key ? null : b.key)}
                  className={`flex items-baseline gap-1.5 rounded px-1.5 py-1 -mx-1.5 text-left transition-colors ${bucketFilter === b.key ? 'bg-primary/10 ring-1 ring-primary/30' : bucketFilter ? 'opacity-50 hover:opacity-100' : 'hover:bg-muted/60'}`}
                >
                  <span className={`inline-block w-2 h-2 rounded-sm ${bucketStyles[b.key].strip}`} />
                  <span className="text-muted-foreground">{b.key}d</span>
                  <span className="font-semibold ml-auto tabular-nums">{b.count}</span>
                  <span className="text-muted-foreground tabular-nums">· {formatCompactINR(b.amt)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter row */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Search customer, contractor, case# or RM…"
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={filterRm} onChange={e => setFilterRm(e.target.value)} className="text-sm border rounded-md px-2 h-9 bg-background md:w-44" aria-label="Filter by RM">
          <option value="all">All RMs</option>
          {uniqueRms.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="text-sm border rounded-md px-2 h-9 bg-background" aria-label="Sort cases">
          <option value="overdue_days">Most overdue first</option>
          <option value="outstanding">Largest amount</option>
          <option value="name">Customer name (A→Z)</option>
        </select>
        <button
          type="button"
          onClick={() => setView(v => v === 'escalated' ? 'all' : 'escalated')}
          className={`text-xs font-medium px-3 h-9 rounded-md border transition-colors ${view === 'escalated' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background text-muted-foreground hover:text-foreground'}`}
          aria-pressed={view === 'escalated'}
        >
          Escalated
        </button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearFilters}>
            <X size={12} className="mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Count line (+ select-all in list mode) */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {viewMode === 'list' && canBulkAssign && sorted.length > 0 && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} className="w-3.5 h-3.5" />
            Select all
          </label>
        )}
        <p>
          <span className="font-semibold text-foreground">{sorted.length}</span>
          {hasActiveFilters ? ` of ${collections.length}` : ''} cases
          · <span className="font-semibold text-foreground">{formatCompactINR(stats.totalOutstanding)}</span> outstanding
        </p>
      </div>

      {/* Main content */}
      {sorted.length === 0 ? (
        <Card className="py-12 border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText size={24} className="text-muted-foreground" />
            </div>
            {hasActiveFilters ? (
              <>
                <p className="text-base font-semibold">No matches</p>
                <p className="text-sm text-muted-foreground mb-3">No overdue cases match the current filters.</p>
                <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">All clear</p>
                <p className="text-sm text-muted-foreground">Nothing overdue right now. 🎉</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'board' ? (
        <BoardView
          cases={sorted}
          d={d}
          boardColOf={boardColOf}
          moveCard={moveCard}
          canHqChat={canHqChat}
          showRm={showRm}
          onOpenChat={setChatOpenForCase}
          paidTodayByCase={paidTodayByCase}
        />
      ) : sortBy === 'overdue_days' && !bucketFilter ? (
        // Default sort groups the queue into severity sections — the sections
        // themselves are the aging distribution, worst first.
        <div className="space-y-5">
          {(['90+', '61-90', '31-60', '1-30'] as BucketKey[]).map(bk => {
            const group = sorted.filter(c => d(c).bucket === bk);
            if (group.length === 0) return null;
            const sum = group.reduce((s, c) => s + d(c).outstanding, 0);
            return (
              <div key={bk} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-sm ${bucketStyles[bk].strip}`} />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{bucketStyles[bk].label}</p>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{group.length} · {formatCompactINR(sum)}</span>
                </div>
                {group.map(renderRow)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">{sorted.map(renderRow)}</div>
      )}

      {/* Floating bulk-action bar */}
      {selectedCaseIds.size > 0 && canBulkAssign && viewMode === 'list' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-background border shadow-lg rounded-full px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium flex items-center gap-2">
            <CheckSquare size={14} className="text-primary" />
            {selectedCaseIds.size} selected
          </span>
          <div className="w-px h-5 bg-border" />
          <form
            action={async (fd: FormData) => {
              await bulkAssignRMs(fd);
              setSelectedCaseIds(new Set());
              setSelectedRm('');
            }}
            className="flex items-center gap-2"
          >
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

      {/* Contact log drawer */}
      {chatCase && (
        <LogDrawer
          c={chatCase}
          dv={d(chatCase)}
          logs={hqLogs.filter(l => l.case_id === chatCase.id)}
          canWrite={canHqChat}
          onClose={() => setChatOpenForCase(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────────────────────
const toneClasses: Record<string, { bg: string; text: string; icon: string }> = {
  neutral: { bg: 'bg-card', text: 'text-foreground', icon: 'text-muted-foreground' },
  severe:  { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-900 dark:text-red-200', icon: 'text-red-700 dark:text-red-400' },
  warn:    { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-900 dark:text-amber-200', icon: 'text-amber-600' },
  success: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-900 dark:text-emerald-200', icon: 'text-emerald-600' },
};

function StatTile({ icon, label, value, sublabel, tone = 'neutral', active, onClick, hint }: {
  icon: React.ReactNode; label: string; value: string; sublabel: string;
  tone?: keyof typeof toneClasses; active: boolean; onClick?: () => void; hint?: string;
}) {
  const t = toneClasses[tone];
  const inner = (
    <CardContent className="p-3">
      <div className={`flex items-center gap-1.5 ${t.icon} mb-1`}>
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-bold leading-tight tabular-nums ${t.text}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{hint || sublabel}</p>
    </CardContent>
  );
  if (!onClick) return <Card className={`${t.bg} border-muted/50`}>{inner}</Card>;
  return (
    <Card className={`${t.bg} text-left transition-shadow cursor-pointer ${active ? 'ring-2 ring-primary border-primary/40' : 'border-muted/50 hover:border-foreground/25'}`}>
      <button type="button" onClick={onClick} className="w-full text-left" aria-pressed={active}>
        {inner}
      </button>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Board view — daily triage kanban
// ─────────────────────────────────────────────────────────────────────────────
const BOARD_COLS: { key: BoardCol; label: string; hint: string }[] = [
  { key: 'backlog', label: 'To triage', hint: 'Not picked up today' },
  { key: 'today',   label: "Today's queue", hint: 'Tackle today' },
  { key: 'working', label: 'In progress', hint: 'Contacted / awaiting reply' },
  { key: 'done',    label: 'Done today', hint: 'Followed up or paid' },
];

function BoardView({ cases, d, boardColOf, moveCard, canHqChat, showRm, onOpenChat, paidTodayByCase }: {
  cases: Case[];
  d: (c: Case) => Derived;
  boardColOf: (c: Case) => BoardCol;
  moveCard: (caseId: string, col: BoardCol) => void;
  canHqChat: boolean;
  showRm: boolean;
  onOpenChat: (caseId: string) => void;
  paidTodayByCase: Map<string, number>;
}) {
  const [dragOverCol, setDragOverCol] = useState<BoardCol | null>(null);

  const byCol = useMemo(() => {
    const m: Record<BoardCol, Case[]> = { backlog: [], today: [], working: [], done: [] };
    for (const c of cases) m[boardColOf(c)].push(c);
    return m;
  }, [cases, boardColOf]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
      {BOARD_COLS.map(col => {
        const colCases = byCol[col.key];
        const colSum = colCases.reduce((s, c) => s + d(c).outstanding, 0);
        const colIdx = BOARD_COLS.findIndex(x => x.key === col.key);
        return (
          <div
            key={col.key}
            className={`flex-1 min-w-[260px] rounded-lg border bg-muted/20 flex flex-col transition-colors ${dragOverCol === col.key ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
            onDragLeave={() => setDragOverCol(cur => cur === col.key ? null : cur)}
            onDrop={e => {
              e.preventDefault();
              setDragOverCol(null);
              const id = e.dataTransfer.getData('text/plain');
              if (id) moveCard(id, col.key);
            }}
          >
            <div className="px-3 py-2.5 border-b">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider">{col.label}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{colCases.length} · {formatCompactINR(colSum)}</p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{col.hint}</p>
            </div>
            <div className="p-2 space-y-2 flex-1 min-h-[120px]">
              {colCases.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 text-center py-6">Drag cases here</p>
              ) : colCases.map(c => {
                const dv = d(c);
                const paidToday = paidTodayByCase.get(c.id);
                return (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', c.id)}
                    className="rounded-md border bg-background p-2.5 shadow-sm cursor-grab active:cursor-grabbing space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{dv.customerName}</p>
                        {dv.contractorName && (
                          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                            <Building2 size={10} className="shrink-0" /> {dv.contractorName}
                          </p>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${bucketStyles[dv.bucket].pill}`}>
                        {dv.worstDpd}d
                      </span>
                    </div>
                    <p className="font-semibold text-sm tabular-nums">{formatINR(dv.outstanding)}</p>
                    <div className="flex flex-wrap gap-1">
                      {dv.activePtp && (
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${dv.activePtp.date === istToday() ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900' : 'bg-muted text-muted-foreground border-border'}`}>
                          PTP {shortDate(dv.activePtp.date)}{dv.activePtp.amount ? ` · ${formatCompactINR(dv.activePtp.amount)}` : ''}
                        </span>
                      )}
                      {dv.brokenPtp && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded border bg-red-100 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900">
                          Broke PTP {shortDate(dv.brokenPtp.date)}
                        </span>
                      )}
                      {paidToday && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900">
                          ₹ {formatCompactINR(paidToday)} received today
                        </span>
                      )}
                      {(c.escalation_level ?? 0) > 0 && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border">
                          L{c.escalation_level}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <p className="text-[11px] text-muted-foreground truncate">
                        {showRm ? `${dv.rmName} · ` : ''}
                        {dv.lastContactDays !== null
                          ? `contact ${dv.lastContactDays}d ago`
                          : 'no contact'}
                      </p>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {canHqChat && (
                          <button type="button" onClick={() => onOpenChat(c.id)} className="p-1 text-muted-foreground hover:text-foreground" title="Contact log" aria-label="Open contact log">
                            <MessageSquare size={13} />
                          </button>
                        )}
                        <Link href={`/cases/${c.id}`} className="p-1 text-muted-foreground hover:text-foreground" title="Open case" aria-label="Open case">
                          <ExternalLink size={13} />
                        </Link>
                        {colIdx > 0 && (
                          <button type="button" onClick={() => moveCard(c.id, BOARD_COLS[colIdx - 1].key)} className="p-1 text-muted-foreground hover:text-foreground" title={`Move to ${BOARD_COLS[colIdx - 1].label}`} aria-label={`Move to ${BOARD_COLS[colIdx - 1].label}`}>
                            <ChevronLeft size={13} />
                          </button>
                        )}
                        {colIdx < BOARD_COLS.length - 1 && (
                          <button type="button" onClick={() => moveCard(c.id, BOARD_COLS[colIdx + 1].key)} className="p-1 text-muted-foreground hover:text-foreground" title={`Move to ${BOARD_COLS[colIdx + 1].label}`} aria-label={`Move to ${BOARD_COLS[colIdx + 1].label}`}>
                            <ChevronRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Case row (list view)
// ─────────────────────────────────────────────────────────────────────────────
function CaseRow({ c, dv, expanded, onToggleExpand, selected, onToggleSelect, showSelect, showRm, canEscalate, canHqChat, canLogPayment, escalationThresholds, hqLogs, relatedCases, onOpenChat }: {
  c: Case;
  dv: Derived;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  showSelect: boolean;
  showRm: boolean;
  canEscalate: boolean;
  canHqChat: boolean;
  canLogPayment: boolean;
  escalationThresholds: any[];
  hqLogs: any[];
  relatedCases: RelatedCase[];
  onOpenChat: () => void;
}) {
  // Payment form state is local to the row — no cross-row resets.
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(istToday());
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [confirmEscalate, setConfirmEscalate] = useState(false);
  const [payTrancheIdx, setPayTrancheIdx] = useState<number | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Payment allocation: oldest overdue tranche by default, user can choose.
  const payTranche = dv.overdueTranches.find(t => t.trancheIndex === payTrancheIdx) || dv.overdueTranches[0];

  const isEscalated = (c.escalation_level ?? 0) > 0;
  const nextLevel = (c.escalation_level ?? 0) + 1;
  const targetRole = escalationThresholds.find(e => e.escalation_level === nextLevel)?.escalate_to_role || 'founder_admin';
  const worstTranche = dv.overdueTranches.length > 0
    ? dv.overdueTranches.reduce((a, b) => (b.daysOverdue > a.daysOverdue ? b : a))
    : undefined;

  // Contractor-level roll-up: all other billed cases sharing this party.
  const keyParty = c.contractor_party_id || c.customer_party_id;
  const related = useMemo(() =>
    keyParty
      ? relatedCases.filter(r => r.id !== c.id && (r.contractor_party_id === keyParty || r.customer_party_id === keyParty))
      : [],
    [relatedCases, keyParty, c.id]
  );
  const relatedBilled = related.reduce((s, r) => s + (r.decided_bill_amount || r.bill_amount || 0), 0);
  const relatedOutstanding = related.reduce((s, r) => s + getOutstanding(r), 0);
  const relatedOverdueCount = related.filter(r => computeOverdueTranches(r).length > 0).length;

  const submitPayment = async () => {
    setPaymentSubmitting(true);
    setPaymentError('');
    if (!payTranche) {
      setPaymentError('No overdue tranches found for this case.');
      setPaymentSubmitting(false);
      return;
    }
    const fd = new FormData();
    fd.set('caseId', c.id);
    fd.set('amount', paymentAmount);
    fd.set('paymentDate', paymentDate);
    fd.set('description', paymentNote || 'Logged from Collections dashboard');
    fd.set('trancheIndex', payTranche.trancheIndex.toString());
    try {
      await handleLogPayment(fd);
      setPaymentSuccess(`Payment of ${formatINR(parseInt(paymentAmount, 10) || 0)} recorded.`);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (e: any) {
      setPaymentError(e.message);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const expandAndFocusPayment = () => {
    if (!expanded) onToggleExpand();
    setTimeout(() => amountRef.current?.focus(), 50);
  };

  return (
    <Card className="overflow-hidden border-border hover:border-foreground/20 transition-colors">
        <div className="min-w-0">
          {/* Collapsed row */}
          <div
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); }
            }}
            className="p-3 sm:p-4 flex items-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <h3 className="font-semibold text-sm sm:text-base truncate">{dv.customerName}</h3>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${bucketStyles[dv.bucket].pill}`}>
                  {dv.worstDpd}d{isEscalated ? ` · L${c.escalation_level}` : ''}
                </span>
                {dv.activePtp && (
                  <span className={`text-[11px] font-semibold rounded border px-1.5 py-0.5 uppercase tracking-wider ${dv.activePtp.date === istToday() ? 'text-amber-900 bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900' : 'text-muted-foreground bg-muted border-border'}`}>
                    PTP {shortDate(dv.activePtp.date)}
                  </span>
                )}
                {dv.brokenPtp && (
                  <span className="text-[11px] font-semibold text-red-900 bg-red-100 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900 rounded px-1.5 py-0.5 uppercase tracking-wider">
                    Broke PTP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {dv.caseNo && <span className="font-mono">{dv.caseNo}</span>}
                {dv.contractorName && (
                  <span className="flex items-center gap-1">
                    {dv.caseNo && <span>·</span>}
                    <Building2 size={11} /> {dv.contractorName}
                  </span>
                )}
                {showRm && (
                  <>
                    <span>·</span>
                    <span>RM: <span className="text-foreground">{dv.rmName}</span></span>
                  </>
                )}
                {(dv.lastContactDays === null || dv.lastContactDays >= 14) && (
                  <>
                    <span>·</span>
                    <span className="text-amber-700 font-medium">
                      {dv.lastContactDays === null ? 'No contact logged' : `No contact ${dv.lastContactDays}d`}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Money block — compact in the row, exact figures in the expanded panel */}
            <div className="text-right shrink-0 w-24 sm:w-32" title={`${formatINR(dv.outstanding)} outstanding · ${formatINR(dv.collected)} of ${formatINR(dv.billed)} collected`}>
              <p className="font-semibold text-sm sm:text-base tabular-nums">
                {formatCompactINR(dv.outstanding)}
              </p>
              <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden" title={`${formatCompactINR(dv.collected)} of ${formatCompactINR(dv.billed)} collected`}>
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dv.collectedPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{dv.collectedPct}% collected</p>
            </div>

            {canLogPayment && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 hidden sm:inline-flex"
                onClick={e => { e.stopPropagation(); expandAndFocusPayment(); }}
              >
                <IndianRupee size={13} className="mr-1" />
                Record payment
              </Button>
            )}

            <ChevronDown
              size={16}
              className={`text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>

          {/* Expanded panel */}
          {expanded && (
            <div className="border-t bg-muted/20 px-3 sm:px-4 py-4 space-y-4">
              {dv.isLegacy && (
                <p className="text-xs text-muted-foreground italic">
                  No scoring trail — this case was grandfathered from a legacy system.
                </p>
              )}

              {/* Tranche breakdown */}
              {dv.overdueTranches.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground mb-2">
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
                        {dv.overdueTranches.map(t => (
                          <tr key={t.trancheIndex} className="border-t">
                            <td className="px-3 py-2 font-mono">T{t.trancheIndex + 1}</td>
                            <td className="px-3 py-2">{t.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatINR(t.expectedAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatINR(t.paidAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatINR(t.outstanding)}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${bucketStyles[getBucket(t.daysOverdue)].pill}`}>
                                {t.daysOverdue}d
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {c.billing_date && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Billing date: {new Date(c.billing_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' · '}Credit terms: {c.composite_credit_days || 0} days
                    </p>
                  )}
                </div>
              )}

              {/* Contractor exposure roll-up */}
              {related.length > 0 && (
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 size={14} className="text-muted-foreground" />
                    <p className="text-xs font-semibold">
                      {dv.contractorName || dv.customerName} — {related.length} other billed case{related.length !== 1 ? 's' : ''}
                    </p>
                    <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
                      {formatCompactINR(relatedBilled)} billed · {formatCompactINR(relatedOutstanding)} outstanding
                      {relatedOverdueCount > 0 && <span className="text-red-700 font-medium"> · {relatedOverdueCount} overdue</span>}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {related.slice(0, 6).map(r => {
                      const rOut = getOutstanding(r);
                      const rDpd = Math.max(0, ...computeOverdueTranches(r).map(t => t.daysOverdue));
                      return (
                        <Link
                          key={r.id}
                          href={`/cases/${r.id}`}
                          className="flex items-center gap-2 text-xs rounded px-2 py-1.5 -mx-2 hover:bg-muted/60"
                        >
                          <span className="truncate flex-1">{partyName(r.customer) || displayCaseNumber(r) || 'Case'}</span>
                          <span className="text-muted-foreground">{r.status}</span>
                          {rDpd > 0 && (
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${bucketStyles[getBucket(rDpd)].pill}`}>
                              {rDpd}d
                            </span>
                          )}
                          <span className="font-semibold tabular-nums w-20 text-right">{rOut > 0 ? formatINR(rOut) : 'Paid'}</span>
                          <ExternalLink size={11} className="text-muted-foreground shrink-0" />
                        </Link>
                      );
                    })}
                    {related.length > 6 && (
                      <p className="text-[11px] text-muted-foreground px-2">+{related.length - 6} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Two-column layout: payment form + recent contact */}
              <div className="grid md:grid-cols-2 gap-4">
                {canLogPayment ? (
                  <div className="rounded-md border bg-background p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <IndianRupee size={14} className="text-emerald-700" />
                      <p className="text-xs font-semibold">Record payment</p>
                      {dv.overdueTranches.length > 1 ? (
                        <select
                          value={payTranche?.trancheIndex ?? 0}
                          onChange={e => setPayTrancheIdx(parseInt(e.target.value, 10))}
                          className="text-[11px] border rounded px-1.5 py-0.5 bg-background ml-auto"
                          aria-label="Apply payment to tranche"
                        >
                          {dv.overdueTranches.map(t => (
                            <option key={t.trancheIndex} value={t.trancheIndex}>
                              T{t.trancheIndex + 1} · due {shortDate(t.dueDate)} · {formatCompactINR(t.outstanding)}
                            </option>
                          ))}
                        </select>
                      ) : payTranche && (
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          applies to T{payTranche.trancheIndex + 1}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={amountRef}
                        type="number"
                        placeholder="Amount ₹"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        className="flex-1 border rounded px-2 py-1.5 text-sm bg-background"
                      />
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                        className="border rounded px-2 py-1.5 text-sm bg-background"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Reference / note (optional)"
                      value={paymentNote}
                      onChange={e => setPaymentNote(e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                    />
                    {paymentError && <p className="text-xs text-destructive">{paymentError}</p>}
                    {paymentSuccess && <p className="text-xs text-emerald-700 font-medium">✓ {paymentSuccess}</p>}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-800"
                        onClick={submitPayment}
                        disabled={!paymentAmount || paymentSubmitting}
                      >
                        {paymentSubmitting ? 'Saving…' : 'Save payment'}
                      </Button>
                      {payTranche && (
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => setPaymentAmount(payTranche.outstanding.toString())}
                        >
                          Settle T{payTranche.trancheIndex + 1} ({formatINR(payTranche.outstanding)})
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                    Payments are recorded by Accounts / KAM. Outstanding here: <span className="font-semibold text-foreground">{formatINR(dv.outstanding)}</span>.
                  </div>
                )}

                {/* Recent contact + PTP status */}
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-muted-foreground" />
                      <p className="text-xs font-semibold">Recent contact</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onOpenChat}>
                      {canHqChat ? 'Log / view' : 'View log'} <ExternalLink size={11} className="ml-1" />
                    </Button>
                  </div>
                  {dv.activePtp && (
                    <p className="text-xs rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 px-2 py-1.5 mb-2 flex items-center gap-1.5">
                      <CalendarClock size={12} className="shrink-0" />
                      Promised{dv.activePtp.amount ? ` ${formatINR(dv.activePtp.amount)}` : ''} by {shortDate(dv.activePtp.date)}
                    </p>
                  )}
                  {dv.brokenPtp && (
                    <p className="text-xs rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 px-2 py-1.5 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={12} className="shrink-0" />
                      Missed promise{dv.brokenPtp.amount ? ` of ${formatINR(dv.brokenPtp.amount)}` : ''} — was due {shortDate(dv.brokenPtp.date)}
                    </p>
                  )}
                  {hqLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No interactions logged yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {hqLogs.slice(-2).reverse().map(log => {
                        const parsed = parseLog(log.message);
                        return (
                          <div key={log.id} className="text-xs">
                            <div className="flex justify-between text-muted-foreground text-[11px] mb-0.5">
                              <span className="font-semibold text-foreground">{log.logged_by_user?.full_name || 'System'}</span>
                              <span>{shortDate(log.created_at)}</span>
                            </div>
                            <p className="line-clamp-2">{parsed.text}</p>
                          </div>
                        );
                      })}
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
                {canEscalate && !confirmEscalate && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setConfirmEscalate(true)}
                  >
                    <ArrowUpRight size={13} className="mr-1.5" />
                    {isEscalated ? `Escalate to L${Math.min(3, nextLevel)}` : 'Escalate'}
                  </Button>
                )}
                {canEscalate && confirmEscalate && (
                  <form action={handleEscalateCase} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="trancheIndex" value={worstTranche?.trancheIndex ?? 0} />
                    <input type="hidden" name="targetRole" value={targetRole} />
                    <span className="text-xs text-muted-foreground">
                      Escalate to L{Math.min(3, nextLevel)} ({targetRole.replace('_', ' ')})?
                    </span>
                    <input
                      type="text"
                      name="reason"
                      placeholder="Reason (optional)"
                      className="border rounded px-2 h-8 text-xs bg-background w-44"
                    />
                    <SubmitButton type="submit" variant="destructive" size="sm" loadingText="Escalating…">
                      Confirm
                    </SubmitButton>
                    <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmEscalate(false)}>
                      Cancel
                    </Button>
                  </form>
                )}
                {canHqChat && (
                  <Button variant="outline" size="sm" onClick={onOpenChat}>
                    <MessageSquare size={13} className="mr-1.5" /> Contact log
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact log drawer with structured entry + PTP capture
// ─────────────────────────────────────────────────────────────────────────────
const LOG_TYPE_ICONS = { call: Phone, visit: MapPin, note: FileText } as const;

function LogDrawer({ c, dv, logs, canWrite, onClose }: {
  c: Case;
  dv: Derived;
  logs: any[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const [contactType, setContactType] = useState<'call' | 'visit' | 'note'>('call');
  const [message, setMessage] = useState('');
  const [ptpOpen, setPtpOpen] = useState(false);
  const [ptpDate, setPtpDate] = useState('');
  const [ptpAmount, setPtpAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageRef.current?.focus();
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!message.trim() && !(ptpOpen && ptpDate)) return;
    setSubmitting(true);
    setError('');
    const fd = new FormData();
    fd.set('caseId', c.id);
    fd.set('message', message);
    fd.set('contactType', contactType);
    fd.set('trancheIndex', (dv.overdueTranches[0]?.trancheIndex ?? 0).toString());
    if (ptpOpen && ptpDate) {
      fd.set('ptpDate', ptpDate);
      if (ptpAmount) fd.set('ptpAmount', ptpAmount);
    }
    try {
      await addHqCollectionLog(fd);
      setMessage('');
      setPtpOpen(false);
      setPtpDate('');
      setPtpAmount('');
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 300);
    } catch (e: any) {
      setError(e?.message || 'Could not save the log.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label="Contact log"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{dv.customerName}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {dv.contractorName ? `${dv.contractorName} · ` : ''}{formatINR(dv.outstanding)} outstanding · {dv.worstDpd}d overdue
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        {/* PTP status banner */}
        {dv.activePtp && (
          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <CalendarClock size={14} className="shrink-0" />
            <span>
              Promised{dv.activePtp.amount ? ` ${formatINR(dv.activePtp.amount)}` : ''} by{' '}
              <span className="font-semibold">{new Date(dv.activePtp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              {dv.activePtp.date === istToday() && ' — follow up today'}
            </span>
          </div>
        )}
        {dv.brokenPtp && (
          <div className="px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>
              Missed promise{dv.brokenPtp.amount ? ` of ${formatINR(dv.brokenPtp.amount)}` : ''} — was due{' '}
              <span className="font-semibold">{new Date(dv.brokenPtp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>.
              Get a fresh commitment below.
            </span>
          </div>
        )}

        {/* Timeline */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={32} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Log the first call or visit below.</p>
            </div>
          ) : (
            logs.map(log => {
              const parsed = parseLog(log.message);
              const Icon = LOG_TYPE_ICONS[parsed.type];
              return (
                <div key={log.id} className="bg-muted/40 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-start mb-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Icon size={12} className="text-muted-foreground" />
                      {log.logged_by_user?.full_name || 'System'}
                      <span className="font-normal text-muted-foreground capitalize">· {parsed.type}</span>
                    </span>
                    <span>{new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                  {parsed.text && <p className="text-sm leading-relaxed">{parsed.text}</p>}
                  {parsed.ptp && (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold rounded border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 px-2 py-0.5">
                      <CalendarClock size={11} />
                      PTP {new Date(parsed.ptp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      {parsed.ptp.amount ? ` · ${formatINR(parsed.ptp.amount)}` : ''}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Entry form */}
        {canWrite && (
          <div className="border-t p-3 bg-muted/20 space-y-2">
            <div className="flex rounded-md border overflow-hidden w-fit" role="group" aria-label="Contact type">
              {(['call', 'visit', 'note'] as const).map((t, i) => {
                const Icon = LOG_TYPE_ICONS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setContactType(t)}
                    className={`flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium capitalize transition-colors ${i > 0 ? 'border-l' : ''} ${contactType === t ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                    aria-pressed={contactType === t}
                  >
                    <Icon size={12} /> {t}
                  </button>
                );
              })}
            </div>
            <Textarea
              ref={messageRef}
              placeholder={contactType === 'call' ? 'What did they say on the call?' : contactType === 'visit' ? 'What happened during the visit?' : 'Add a note…'}
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ptpOpen}
                onChange={e => setPtpOpen(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              <span className="font-medium">They promised to pay</span>
              <span className="text-muted-foreground">(records a PTP and reminds you on the day)</span>
            </label>
            {ptpOpen && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={ptpDate}
                  min={istToday()}
                  onChange={e => setPtpDate(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm bg-background"
                  aria-label="Promised payment date"
                />
                <input
                  type="number"
                  placeholder="Amount ₹ (optional)"
                  value={ptpAmount}
                  onChange={e => setPtpAmount(e.target.value)}
                  className="flex-1 border rounded px-2 py-1.5 text-sm bg-background"
                  aria-label="Promised amount"
                />
              </div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={submit}
                disabled={submitting || (!message.trim() && !(ptpOpen && ptpDate)) || (ptpOpen && !ptpDate)}
              >
                {submitting ? 'Saving…' : ptpOpen && ptpDate ? 'Log + set PTP' : 'Log'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
