import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Briefcase, PlusCircle, Wallet, ShieldCheck, FileEdit, Undo2, BadgeCheck,
  ClipboardList, Hourglass, Scale, AlertTriangle, Users,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';
import { MetricCard } from '@/components/creditflow/MetricCard';
import { TaskKanban } from '@/components/creditflow/TaskKanban';
import { WorkItemRow } from '@/components/creditflow/WorkItemRow';
import { StatusBadge } from '@/components/creditflow/StatusBadge';
import { LoadFailed } from '@/components/creditflow/LoadFailed';
import { formatCompactINR, relativeDays, daysUntil } from '@/lib/format';
import { ROLE_LABELS, GLOSSARY } from '@/lib/vocabulary';
import {
  METRIC_PERIOD_DAYS, APPROVED_STATUSES, REJECTED_STATUSES, PORTFOLIO_STATUSES,
  approvalSuccessRate, collectionRealisation, computeTranchePdcr, formatDaysVsPromised,
  outstandingExposure, type MetricCase, type Repayment,
} from '@/lib/metrics';

// ── Portfolio metrics (server-side; formulas live in src/lib/metrics.ts) ──────
// A metric is a number, null (no data yet), or UNAVAILABLE (its query failed).
// A failed query must never read as zero or "no data" (doctrine §13.6).
const UNAVAILABLE = 'unavailable' as const;
type MetricValue = number | null | typeof UNAVAILABLE;
type RmMetricKey = 'totalExposure' | 'collectionRealisation' | 'countPDCR' | 'amountPDCR' | 'avgDaysVsPromised' | 'approvalSuccessRate';

async function computeRmPortfolioMetrics(supabase: any, rmUserId?: string | null): Promise<Record<RmMetricKey, MetricValue>> {
  // Only filter by RM when one is set — `.eq('rm_user_id', null)` matches nothing.
  const byRm = (q: any) => (rmUserId ? q.eq('rm_user_id', rmUserId) : q);
  const cutoff = new Date(Date.now() - METRIC_PERIOD_DAYS * 86400000).toISOString();

  const [casesRes, decidedRes] = await Promise.all([
    byRm(supabase.from('credit_cases')
      .select('id, decided_bill_amount, promised_bill_amount, bill_amount, actual_bill_amount, proposed_tranches, billing_date, status')
      .in('status', PORTFOLIO_STATUSES)),
    // Filter on submitted_at (set on submit in engine.ts): every Approved or
    // Rejected case has been submitted, and this is the "cases submitted in the
    // period" the scope line describes. created_at would miss older drafts that
    // were submitted recently.
    byRm(supabase.from('credit_cases')
      .select('status')
      .in('status', [...APPROVED_STATUSES, ...REJECTED_STATUSES])
      .gte('submitted_at', cutoff)),
  ]);
  if (casesRes.error) console.error('[home] portfolio cases query failed', casesRes.error);
  if (decidedRes.error) console.error('[home] approval success query failed', decidedRes.error);

  const approvalSuccess: MetricValue = decidedRes.error
    ? UNAVAILABLE
    : approvalSuccessRate((decidedRes.data ?? []) as { status: string }[]);

  if (casesRes.error) {
    return {
      totalExposure: UNAVAILABLE,
      collectionRealisation: UNAVAILABLE,
      countPDCR: UNAVAILABLE,
      amountPDCR: UNAVAILABLE,
      avgDaysVsPromised: UNAVAILABLE,
      approvalSuccessRate: approvalSuccess,
    };
  }

  const cases: MetricCase[] = casesRes.data ?? [];

  if (cases.length === 0) {
    return {
      totalExposure: 0,
      collectionRealisation: null,
      countPDCR: null,
      amountPDCR: null,
      avgDaysVsPromised: null,
      approvalSuccessRate: approvalSuccess,
    };
  }

  const caseIds = cases.map((c) => c.id);
  const { data: allRepayments, error: repaymentsError } = await supabase
    .from('repayments')
    .select('case_id, amount, payment_date')
    .in('case_id', caseIds)
    .order('case_id')
    .order('created_at', { ascending: true });

  if (repaymentsError) {
    console.error('[home] repayments query failed', repaymentsError);
    return {
      totalExposure: outstandingExposure(cases),
      collectionRealisation: collectionRealisation(cases),
      countPDCR: UNAVAILABLE,
      amountPDCR: UNAVAILABLE,
      avgDaysVsPromised: UNAVAILABLE,
      approvalSuccessRate: approvalSuccess,
    };
  }

  const repaymentsByCaseId = (allRepayments ?? []).reduce((acc: Record<string, Repayment[]>, r: any) => {
    if (!acc[r.case_id]) acc[r.case_id] = [];
    acc[r.case_id].push(r);
    return acc;
  }, {} as Record<string, Repayment[]>);

  const pdcr = computeTranchePdcr(cases, repaymentsByCaseId);

  return {
    totalExposure: outstandingExposure(cases),
    collectionRealisation: collectionRealisation(cases),
    countPDCR: pdcr.countPDCR,
    amountPDCR: pdcr.amountPDCR,
    avgDaysVsPromised: pdcr.avgDaysVsPromised,
    approvalSuccessRate: approvalSuccess,
  };
}

// ── Tranche helpers ───────────────────────────────────────────────────────────

type TrancheDef = { type?: string; value: number; days_after_billing?: number | null };

type TrancheCaseRow = {
  id: string;
  case_number: string;
  billing_date: string | null;
  decided_bill_amount: number | null;
  promised_bill_amount: number | null;
  bill_amount: number | null;
  actual_bill_amount: number | null;
  composite_credit_days: number | null;
  proposed_tranches: unknown;
  customer?: { legal_name?: string | null } | null;
};

type TrancheItem = {
  caseId: string;
  caseNumber: string;
  customerName: string;
  dueDate: Date;
  unpaid: number;
  daysOverdue: number;
};

/**
 * Same estimated-schedule fallback as collections/page.tsx: a case with no decided
 * amount or tranche schedule gets one estimated tranche (promised/bill amount, due
 * after the composite credit terms), so home and /collections count the same cases.
 * Keep the two in step until the helper is shared.
 */
function withEstimatedSchedule(c: TrancheCaseRow): TrancheCaseRow {
  const hasSchedule = !!c.decided_bill_amount
    && Array.isArray(c.proposed_tranches) && c.proposed_tranches.length > 0;
  const amount = c.promised_bill_amount || c.bill_amount || 0;
  if (!c.billing_date || hasSchedule || amount <= 0) return c;
  return {
    ...c,
    decided_bill_amount: c.decided_bill_amount ?? amount,
    proposed_tranches: [{ type: 'amount', value: amount, days_after_billing: c.composite_credit_days || 0 }],
  };
}

function computeTrancheQueue(activeCases: TrancheCaseRow[]) {
  const upcoming: TrancheItem[] = [];
  const delayed: TrancheItem[] = [];
  const now = new Date();

  for (const c of activeCases) {
    if (!c.billing_date || !(Array.isArray(c.proposed_tranches) && c.proposed_tranches.length > 0) || !c.decided_bill_amount) continue;
    const billingDate = new Date(c.billing_date);
    let remaining = c.actual_bill_amount ?? 0;

    for (const t of c.proposed_tranches as TrancheDef[]) {
      const amt = t.type === 'percentage'
        ? Math.round((t.value / 100) * c.decided_bill_amount)
        : Math.round(t.value);
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      const fill = Math.min(remaining, amt);
      remaining -= fill;
      const unpaid = amt - fill;
      if (unpaid <= 0) continue;

      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86400000);
      const item = {
        caseId: c.id,
        caseNumber: c.case_number,
        customerName: c.customer?.legal_name ?? '—',
        dueDate: due,
        unpaid,
        daysOverdue,
      };
      if (due < now) delayed.push(item);
      else upcoming.push(item);
    }
  }
  upcoming.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  delayed.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { upcoming, delayed };
}

/** A board ballot row, or an open round still waiting for its ballot (awaiting). */
type BoardVote = {
  key: string;
  approval_round: { round_type?: string; review_cycle?: { case?: BoardCase | null } | null } | null;
  vote_window_end: string | null;
  myVote: { decision: string } | null;
  voteUnknown: boolean;
  href: string;
  awaiting: boolean;
};

type BoardCase = {
  id?: string;
  case_number?: string;
  bill_amount?: number | null;
  customer?: { legal_name?: string | null } | null;
};

/** A case row from the My Work case queries (recent activity). */
type CaseRow = {
  id: string;
  case_number: string;
  status: string;
  bill_amount: number | null;
  created_at: string;
  updated_at: string;
  customer?: { legal_name?: string | null } | null;
};

function QueueSection({ title, icon: Icon, count, children, viewAllHref, tone = 'default', failedWhat }: {
  title: string;
  icon: LucideIcon;
  count: number;
  children?: ReactNode;
  viewAllHref?: string;
  tone?: 'default' | 'danger';
  failedWhat?: string;
}) {
  return (
    <Card className={tone === 'danger' ? 'border-destructive/30' : ''}>
      <CardHeader className="pb-0 pt-4 px-4 sm:px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icon size={15} className={tone === 'danger' ? 'text-destructive' : 'text-primary'} aria-hidden="true" />
            {title}
            <span className="text-muted-foreground font-normal">({failedWhat ? '—' : count})</span>
          </CardTitle>
          {viewAllHref && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={viewAllHref} className="text-tiny font-semibold uppercase tracking-wider">View all</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 mt-2">
        {failedWhat ? <div className="p-4 sm:p-5"><LoadFailed what={failedWhat} /></div> : children}
      </CardContent>
    </Card>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="px-5 py-6 text-sm text-muted-foreground">{text}</p>
);

/** "9 Nov" — short date in IST, used for "as of" and deadline labels. */
const NO_DATA = 'No data yet';

/** Metric card text: a failed query is 'Unavailable', genuinely no data is NO_DATA. */
const metricText = (v: MetricValue | undefined, fmt: (n: number) => string) =>
  v === UNAVAILABLE ? 'Unavailable' : typeof v === 'number' ? fmt(v) : NO_DATA;
const numberOrNull = (v: MetricValue | undefined) => (typeof v === 'number' ? v : null);

/** ISO timestamp N days ago. Kept out of the component body (react-hooks/purity). */
const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

// ── My Work page ─────────────────────────────────────────────────────────────

export default async function MyWorkPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const role = await getImpersonationRole();
  const isRm = role === 'rm';
  const isAdmin = role === 'founder_admin';
  const isKam = role === 'kam';
  const isApprover = role === 'ordinary_approver';
  const isBoardMember = role === 'board_member';
  const isContributor = role === 'bdo' || role === 'accounts';
  const canCollect = ['rm', 'kam', 'accounts', 'founder_admin'].includes(role);
  const canOriginate = ['rm', 'founder_admin'].includes(role);

  const caseSelect = `
    id, case_number, status, substatus, case_scenario, bill_amount, composite_credit_days, created_at, updated_at,
    billing_date, decided_bill_amount, actual_bill_amount, proposed_tranches,
    customer:parties!credit_cases_customer_party_id_fkey(legal_name),
    rm:profiles!credit_cases_rm_user_id_fkey(full_name),
    kam:profiles!credit_cases_kam_user_id_fkey(full_name),
    review_cycles(validity_expires_at, is_active)
  `;

  const scoped = (q: any) => {
    if (isRm && user) return q.eq('rm_user_id', user.id);
    if (isKam && user) return q.eq('kam_user_id', user.id);
    return q;
  };

  // ── Shared fetches ─────────────────────────────────────────────────────────
  const recentQuery = scoped(supabase.from('credit_cases')
    .select(caseSelect)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(5));

  // Real assigned tasks (not notifications) — doctrine: a task ≠ a notification.
  const taskSelect = `id, description, status, sla_deadline, stage, is_waiting, waiting_reason, completed_at,
    review_cycle:review_cycles!stage_tasks_review_cycle_id_fkey(
      case:credit_cases!review_cycles_case_id_fkey(id, case_number, status, bill_amount,
        customer:parties!credit_cases_customer_party_id_fkey(legal_name)))`;
  const myTasksQuery = user
    ? supabase.from('stage_tasks')
      .select(taskSelect)
      .eq('assigned_to', user.id)
      .in('status', ['Pending', 'In Progress'])
      .order('sla_deadline', { ascending: true, nullsFirst: false })
      .limit(50)
    : Promise.resolve({ data: [], error: null });

  // Recently finished tasks feed the "Done" column of the task board.
  const doneCutoff = isoDaysAgo(14);
  const doneTasksQuery = user
    ? supabase.from('stage_tasks')
      .select(taskSelect)
      .eq('assigned_to', user.id)
      .in('status', ['Completed', 'Waived'])
      .gte('completed_at', doneCutoff)
      .order('completed_at', { ascending: false })
      .limit(20)
    : Promise.resolve({ data: [], error: null });

  // Queues whose query failed, keyed by queue, with the label for "Couldn't load …".
  // A failed queue shows an error, never an empty list or a zero count.
  const failedQueues = new Map<string, string>();
  const rowsOf = (key: string, what: string, res: { data: any; error: unknown }): any[] => {
    if (res.error) {
      console.error(`[home] ${key} query failed`, res.error);
      failedQueues.set(key, what);
    }
    return res.data || [];
  };

  const [recentRes, myTasksRes, doneTasksRes] = await Promise.all([recentQuery, myTasksQuery, doneTasksQuery]);
  const recentCases: CaseRow[] = rowsOf('recent', 'recent activity', recentRes);
  const toKanban = (rows: any[]) => rows
    .filter((t: any) => t.review_cycle?.case?.id)
    .map((t: any) => ({ ...t, case: t.review_cycle.case }));
  const myTasks = toKanban(rowsOf('myTasks', 'your tasks', myTasksRes));
  const myDoneTasks = toKanban(rowsOf('myDone', 'your completed tasks', doneTasksRes));

  // ── Role queues ────────────────────────────────────────────────────────────
  let rmDrafts: any[] = [], rmReturned: any[] = [], rmApproved: any[] = [];
  let kamAwaiting: any[] = [], kamDecision: any[] = [], kamUnassigned: any[] = [];
  let approverRounds: any[] = [], boardVotes: BoardVote[] = [];
  let delayedTranches: TrancheItem[] = [], upcomingTranches: TrancheItem[] = [];
  let rmMetrics: any = null;
  let adminData: { pendingCreditNotes: number; pendingWriteOffs: number } | null = null;

  if (isRm && user) {
    const [draftsRes, returnedRes, approvedRes] = await Promise.all([
      supabase.from('credit_cases').select(caseSelect).eq('rm_user_id', user.id).eq('status', 'Draft').order('updated_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select(caseSelect).eq('rm_user_id', user.id).eq('status', 'In Review').eq('substatus', 'Returned for revision').order('updated_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select(caseSelect).eq('rm_user_id', user.id).eq('status', 'Approved').order('updated_at', { ascending: false }).limit(10),
    ]);
    rmDrafts = rowsOf('rmDrafts', 'incomplete drafts', draftsRes);
    rmReturned = rowsOf('rmReturned', 'returned cases', returnedRes);
    rmApproved = rowsOf('rmApproved', 'approved cases', approvedRes);
  }

  if (isKam && user) {
    const [awaitingRes, decisionRes, unassignedRes] = await Promise.all([
      supabase.from('credit_cases').select(caseSelect).eq('kam_user_id', user.id).in('status', ['In Review', 'Awaiting Input']).order('updated_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select(caseSelect).eq('kam_user_id', user.id).in('status', ['Awaiting Approval', 'Appealed']).order('updated_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select(caseSelect).is('kam_user_id', null).in('status', ['In Review', 'Awaiting Input']).order('created_at', { ascending: false }).limit(10),
    ]);
    kamAwaiting = rowsOf('kamAwaiting', 'cases in review', awaitingRes);
    kamDecision = rowsOf('kamDecision', 'cases awaiting a decision', decisionRes);
    kamUnassigned = rowsOf('kamUnassigned', 'unassigned cases', unassignedRes);
  }

  if (isApprover && user) {
    // Ordinary rounds only (appeals and ambiguity reviews go to the board), and
    // rounds this approver already decided are excluded in SQL so the limit
    // applies after filtering, not before.
    // Only this approver's decisions on OPEN ORDINARY rounds are needed to exclude
    // rounds from the queue, so the id list stays small however long their history is.
    const { data: myDecisions, error: myDecisionsError } = await supabase.from('approval_decisions')
      .select('approval_round_id, approval_round:approval_rounds!approval_decisions_approval_round_id_fkey!inner(status, round_type)')
      .eq('approver_id', user.id)
      .eq('approval_round.status', 'open')
      .eq('approval_round.round_type', 'ordinary');
    const decidedIds = (myDecisions || []).map((d: any) => d.approval_round_id);
    let pendingQuery = supabase.from('approval_rounds')
      .select('id, stage, round_type, created_at, review_cycle:review_cycles!approval_rounds_review_cycle_id_fkey(case:credit_cases!review_cycles_case_id_fkey(id, case_number, bill_amount, requested_exposure_amount, customer:parties!credit_cases_customer_party_id_fkey(legal_name)))')
      .eq('status', 'open').eq('round_type', 'ordinary')
      .order('created_at', { ascending: true }).limit(20);
    if (decidedIds.length > 0) pendingQuery = pendingQuery.not('id', 'in', `(${decidedIds.join(',')})`);
    const { data: pendingDecisions, error: pendingError } = await pendingQuery;
    if (myDecisionsError) console.error('[home] approver decisions query failed', myDecisionsError);
    if (pendingError) console.error('[home] approver queue query failed', pendingError);
    // If we cannot tell which rounds this user already decided, show an error
    // rather than risk listing rounds they have voted on.
    if (myDecisionsError || pendingError) {
      failedQueues.set('approver', 'your decision queue');
    } else {
      approverRounds = pendingDecisions || [];
    }
  }

  if (isBoardMember && user) {
    const BOARD_ROUND_TYPES = ['appeal', 'ambiguity_board'];
    const nowIso = new Date().toISOString();
    const caseEmbed = 'case:credit_cases!review_cycles_case_id_fkey(id, case_number, bill_amount, customer:parties!credit_cases_customer_party_id_fkey(legal_name))';
    const [rosterRes, ballotsRes, pendingRoundsRes] = await Promise.all([
      supabase.from('committee_rosters').select('member_ids').eq('is_active', true),
      // Open ballots where the user is on the frozen roster and the window is still open.
      supabase.from('board_rounds')
        .select(`id, vote_window_end, roster_snapshot, approval_round:approval_rounds!board_rounds_approval_round_id_fkey(round_type, review_cycle:review_cycles!approval_rounds_review_cycle_id_fkey(${caseEmbed}))`)
        .eq('status', 'open').gt('vote_window_end', nowIso).contains('roster_snapshot', [user.id])
        .order('vote_window_end', { ascending: true }).limit(20),
      // Open appeal / ambiguity rounds. A ballot is created lazily, so some may have none yet.
      supabase.from('approval_rounds')
        .select(`id, round_type, created_at, board_rounds!board_rounds_approval_round_id_fkey(id), review_cycle:review_cycles!approval_rounds_review_cycle_id_fkey(${caseEmbed})`)
        .eq('status', 'open').in('round_type', BOARD_ROUND_TYPES)
        .order('created_at', { ascending: true }).limit(20),
    ]);

    if (rosterRes.error) console.error('[home] committee roster query failed', rosterRes.error);
    if (ballotsRes.error) console.error('[home] board ballots query failed', ballotsRes.error);
    if (pendingRoundsRes.error) console.error('[home] board pending rounds query failed', pendingRoundsRes.error);
    // Without the roster or ballot lists we cannot say what is due, so show an error.
    if (rosterRes.error || ballotsRes.error || pendingRoundsRes.error) failedQueues.set('board', 'your board ballots');

    const onActiveRoster = (rosterRes.data || []).some((r: any) => (r.member_ids || []).includes(user.id));
    const ballots = (ballotsRes.data || []).filter((b: any) => BOARD_ROUND_TYPES.includes(b.approval_round?.round_type));
    const hasBallot = (embed: any) => (Array.isArray(embed) ? embed.length > 0 : !!embed);
    const awaitingBallot = onActiveRoster
      ? (pendingRoundsRes.data || []).filter((r: any) => !hasBallot(r.board_rounds))
      : [];

    const ballotIds = ballots.map((b: any) => b.id);
    const { data: myVotes, error: myVotesError } = ballotIds.length > 0
      ? await supabase.from('board_votes').select('board_round_id, decision, updated_at')
        .eq('voter_id', user.id).in('board_round_id', ballotIds)
      : { data: [] as any[], error: null };
    if (myVotesError) console.error('[home] board votes query failed', myVotesError);
    // If the vote lookup failed, "not voted" would be a guess, so mark the status unknown.
    const voteUnknown = !!myVotesError;
    const myVoteByRound = new Map((myVotes || []).map((v: any) => [v.board_round_id, v]));

    // Un-voted ballots first, then voted ones (still changeable until the window closes).
    boardVotes = [
      ...ballots.map((b: any) => ({
        key: `ballot-${b.id}`,
        approval_round: b.approval_round,
        vote_window_end: b.vote_window_end,
        myVote: myVoteByRound.get(b.id) ?? null,
        voteUnknown,
        href: `/cases/${b.approval_round?.review_cycle?.case?.id}/board`,
        awaiting: false,
      })),
      ...awaitingBallot.map((r: any) => ({
        key: `round-${r.id}`,
        approval_round: { round_type: r.round_type, review_cycle: r.review_cycle },
        vote_window_end: null,
        myVote: null,
        voteUnknown: false,
        href: `/cases/${r.review_cycle?.case?.id}/board`,
        awaiting: true,
      })),
    ].sort((a: any, b: any) => {
      if (!!a.myVote !== !!b.myVote) return a.myVote ? 1 : -1;
      const ta = a.vote_window_end ? new Date(a.vote_window_end).getTime() : Infinity;
      const tb = b.vote_window_end ? new Date(b.vote_window_end).getTime() : Infinity;
      return ta - tb;
    });
  }

  if (canCollect && user) {
    let activeQuery = supabase
      .from('credit_cases')
      .select('id, case_number, billing_date, decided_bill_amount, promised_bill_amount, bill_amount, actual_bill_amount, composite_credit_days, proposed_tranches, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
      .in('status', ['Billing Active', 'Pending Write-Off Approval']);
    if (isRm) activeQuery = activeQuery.eq('rm_user_id', user.id);
    if (isKam) activeQuery = activeQuery.eq('kam_user_id', user.id);
    const { data: activeCases, error: activeCasesError } = await activeQuery;
    if (activeCasesError) {
      console.error('[home] collections cases query failed', activeCasesError);
      failedQueues.set('tranches', 'upcoming collections');
    }
    const q = computeTrancheQueue(((activeCases ?? []) as TrancheCaseRow[]).map(withEstimatedSchedule));
    delayedTranches = q.delayed;
    upcomingTranches = q.upcoming;
  }

  if ((isRm || isAdmin) && user) {
    rmMetrics = await computeRmPortfolioMetrics(supabase, isRm ? user.id : null);
  }

  if (isAdmin) {
    const [creditNotesRes, writeOffsRes] = await Promise.all([
      supabase.from('credit_notes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('credit_cases').select('id', { count: 'exact', head: true }).eq('status', 'Pending Write-Off Approval'),
    ]);
    adminData = {
      pendingCreditNotes: creditNotesRes.count || 0,
      pendingWriteOffs: writeOffsRes.count || 0,
    };
    if (creditNotesRes.error || writeOffsRes.error) failedQueues.set('admin', 'exceptions');
  }

  const todayIST = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const metricsAsOf = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const pdcrAmount = numberOrNull(rmMetrics?.amountPDCR);
  const pdcrCount = numberOrNull(rmMetrics?.countPDCR);
  const avgDaysVsPromised = numberOrNull(rmMetrics?.avgDaysVsPromised);

  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Work</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {todayIST} · {ROLE_LABELS[role] || role} workspace
          </p>
        </div>
        <div className="flex gap-2">
          {canOriginate && (
            <Button asChild size="sm">
              <Link href="/cases/new"><PlusCircle size={15} aria-hidden="true" /> New Case</Link>
            </Button>
          )}
          {canCollect && (
            <Button asChild size="sm" variant="outline">
              <Link href="/collections"><Wallet size={15} aria-hidden="true" /> Collections</Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild size="sm" variant="outline">
              <Link href="/policy"><ShieldCheck size={15} aria-hidden="true" /> Policy</Link>
            </Button>
          )}
        </div>
      </div>

      {canCollect && failedQueues.has('tranches') && <LoadFailed what="overdue payments" />}

      {/* ── Urgent collections — links to the exact queue behind the number ── */}
      {canCollect && delayedTranches.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 sm:p-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-destructive" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {delayedTranches.length} overdue payment{delayedTranches.length !== 1 ? 's' : ''} · {formatCompactINR(delayedTranches.reduce((s, t) => s + t.unpaid, 0))} outstanding
                </p>
                <p className="text-xs text-muted-foreground">
                  Oldest is {delayedTranches[0].daysOverdue} days past due ({delayedTranches[0].caseNumber} · {delayedTranches[0].customerName})
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="ml-auto border-destructive/40 text-destructive hover:bg-destructive/10">
              <Link href="/collections">Open collections queue</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Role work queues ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* Assigned tasks — primary surface for BDO/Accounts, shown to all */}
        <QueueSection
          title={isContributor ? 'Your assigned tasks' : 'Tasks assigned to you'}
          icon={ClipboardList}
          count={myTasks.length}
          viewAllHref="/cases"
          failedWhat={failedQueues.get('myTasks')}
        >
          {myTasks.length === 0 ? <Empty text="No open tasks assigned to you." /> : myTasks.slice(0, 8).map((t: any) => {
            const c = t.review_cycle?.case;
            const until = daysUntil(t.sla_deadline);
            const overdue = until !== null && until < 0;
            return (
              <WorkItemRow
                key={t.id}
                href={`/cases/${c.id}`}
                title={c.case_number}
                party={c.customer?.legal_name}
                amount={c.bill_amount}
                reason={`Stage ${t.stage} task: ${t.description}`}
                owner={t.is_waiting ? 'Waiting — SLA paused' : null}
                dueLabel={t.sla_deadline ? (overdue ? `Overdue ${Math.abs(until!)}d` : until === 0 ? 'Due today' : `Due ${relativeDays(t.sla_deadline)}`) : null}
                overdue={overdue}
                actionLabel="Open task"
              />
            );
          })}
        </QueueSection>

        {/* RM queues */}
        {isRm && (
          <>
            <QueueSection title="Returned for revision" icon={Undo2} count={rmReturned.length} tone={rmReturned.length ? 'danger' : 'default'} failedWhat={failedQueues.get('rmReturned')}>
              {rmReturned.length === 0 ? <Empty text="No cases waiting on corrections from you." /> : rmReturned.map((c: any) => (
                <WorkItemRow
                  key={c.id}
                  href={`/cases/${c.id}`}
                  title={c.case_number}
                  party={c.customer?.legal_name}
                  amount={c.bill_amount}
                  reason="A reviewer returned this case — corrections are required before resubmission."
                  dueLabel={`Returned ${relativeDays(c.updated_at)}`}
                  actionLabel="Fix and resubmit"
                />
              ))}
            </QueueSection>

            <QueueSection title="Incomplete drafts" icon={FileEdit} count={rmDrafts.length} failedWhat={failedQueues.get('rmDrafts')}>
              {rmDrafts.length === 0 ? <Empty text="No drafts in progress." /> : rmDrafts.map((c: any) => (
                <WorkItemRow
                  key={c.id}
                  href={`/cases/${c.id}`}
                  title={c.case_number}
                  party={c.customer?.legal_name || 'No party yet'}
                  amount={c.bill_amount}
                  reason="Draft saved — not yet submitted for review."
                  meta={`Last edited ${relativeDays(c.updated_at)}`}
                  actionLabel="Continue intake"
                />
              ))}
            </QueueSection>

            <QueueSection title="Approved — awaiting negotiation" icon={BadgeCheck} count={rmApproved.length} failedWhat={failedQueues.get('rmApproved')}>
              {rmApproved.length === 0 ? <Empty text="No approved cases waiting on customer negotiation." /> : rmApproved.map((c: any) => (
                (() => {
                  const cycle = (c.review_cycles || []).find((item: any) => item.is_active);
                  const until = daysUntil(cycle?.validity_expires_at);
                  return (
                <WorkItemRow
                  key={c.id}
                  href={`/cases/${c.id}`}
                  title={c.case_number}
                  party={c.customer?.legal_name}
                  amount={c.bill_amount}
                  reason="Terms are approved. Record the customer's accepted terms to hand over to billing."
                  meta={`Approved ${relativeDays(c.updated_at)}`}
                  dueLabel={until == null ? null : until < 0 ? `Expired ${Math.abs(until)}d ago` : until === 0 ? 'Expires today' : `Valid for ${until}d`}
                  actionLabel="Record accepted terms"
                />
                  );
                })()
              ))}
            </QueueSection>
          </>
        )}

        {/* KAM queues */}
        {isKam && (
          <>
            <QueueSection title="Unassigned new cases" icon={Users} count={kamUnassigned.length} tone={kamUnassigned.length ? 'danger' : 'default'} failedWhat={failedQueues.get('kamUnassigned')}>
              {kamUnassigned.length === 0 ? <Empty text="No unassigned cases in review." /> : kamUnassigned.map((c: any) => (
                <WorkItemRow
                  key={c.id}
                  href={`/cases/${c.id}`}
                  title={c.case_number}
                  party={c.customer?.legal_name}
                  amount={c.bill_amount}
                  reason={`Submitted ${relativeDays(c.created_at)} by ${c.rm?.full_name || 'RM'} — needs a KAM owner.`}
                  actionLabel="Triage"
                />
              ))}
            </QueueSection>

            <QueueSection title="In review — your cases" icon={ClipboardList} count={kamAwaiting.length} viewAllHref="/cases?phase=review" failedWhat={failedQueues.get('kamAwaiting')}>
              {kamAwaiting.length === 0 ? <Empty text="No cases currently in review." /> : kamAwaiting.map((c: any) => (
                <WorkItemRow
                  key={c.id}
                  href={`/cases/${c.id}`}
                  title={c.case_number}
                  party={c.customer?.legal_name}
                  amount={c.bill_amount}
                  reason={c.substatus ? `Waiting: ${c.substatus}` : 'Evidence tasks in progress.'}
                  meta={`Last activity ${relativeDays(c.updated_at)}`}
                  actionLabel="Open workspace"
                />
              ))}
            </QueueSection>

            <QueueSection title="Ready for decision" icon={Hourglass} count={kamDecision.length} viewAllHref="/cases?phase=decision" failedWhat={failedQueues.get('kamDecision')}>
              {kamDecision.length === 0 ? <Empty text="No cases waiting on a decision." /> : kamDecision.map((c: any) => (
                <WorkItemRow
                  key={c.id}
                  href={`/cases/${c.id}`}
                  title={c.case_number}
                  party={c.customer?.legal_name}
                  amount={c.bill_amount}
                  reason={c.status === 'Appealed' ? 'Appeal under board review.' : 'Waiting on an approver decision.'}
                  meta={`Since ${relativeDays(c.updated_at)}`}
                  actionLabel="Track decision"
                />
              ))}
            </QueueSection>
          </>
        )}

        {/* Approver queue — ordered by waiting time and exposure */}
        {isApprover && (
          <QueueSection title="Decisions due from you" icon={Hourglass} count={approverRounds.length} viewAllHref="/cases?phase=decision" failedWhat={failedQueues.get('approver')}>
            {approverRounds.length === 0 ? <Empty text="No open decision rounds need your vote." /> : approverRounds.map((r: any) => {
              const c = r.review_cycle?.case;
              return (
                <WorkItemRow
                  key={r.id}
                  href={`/cases/${c?.id}`}
                  title={c?.case_number || 'Unknown case'}
                  party={c?.customer?.legal_name}
                  amount={c?.requested_exposure_amount || c?.bill_amount}
                  reason={`Stage ${r.stage} decision — review the decision brief.`}
                  dueLabel={`Waiting ${relativeDays(r.created_at)}`}
                  actionLabel="Review and decide"
                />
              );
            })}
          </QueueSection>
        )}

        {/* Board queue */}
        {isBoardMember && (
          <QueueSection title="Board ballots open" icon={Scale} count={boardVotes.length} failedWhat={failedQueues.get('board')}>
            {boardVotes.length === 0 ? <Empty text="No open board votes." /> : boardVotes.map((v: BoardVote) => {
              const ar = v.approval_round;
              const c = ar?.review_cycle?.case;
              const typeLabel = ar?.round_type === 'appeal' ? 'Appeal' : 'Ambiguity review';
              const until = daysUntil(v.vote_window_end);
              const dueLabel = v.voteUnknown
                ? null
                : v.myVote
                  ? (v.vote_window_end ? `Can change until ${shortDate(v.vote_window_end)}` : null)
                  : v.awaiting
                    ? null
                    : (until === 0 ? 'Closes today' : until !== null ? `Closes in ${until}d` : null);
              return (
                <WorkItemRow
                  key={v.key}
                  href={v.href}
                  title={c?.case_number || 'Unknown case'}
                  party={c?.customer?.legal_name}
                  amount={c?.bill_amount}
                  reason={v.voteUnknown
                    ? `${typeLabel} — we could not load your vote. Open the case board to check it.`
                    : v.myVote
                      ? `${typeLabel} — you voted ${v.myVote.decision}. Other votes stay hidden until the window closes.`
                      : v.awaiting
                        ? `${typeLabel} — ballot is being set up for this case.`
                        : `${typeLabel} — independent ballot. Other votes stay hidden until the window closes.`}
                  dueLabel={dueLabel}
                  actionLabel={v.voteUnknown ? 'Open case board' : v.myVote ? 'Change vote' : v.awaiting ? 'Open case board' : 'Cast your vote'}
                />
              );
            })}
          </QueueSection>
        )}

        {/* Admin exceptions */}
        {isAdmin && adminData && (
          <QueueSection title="Exceptions needing your authority" icon={AlertTriangle} count={adminData.pendingWriteOffs + adminData.pendingCreditNotes} tone={(adminData.pendingWriteOffs + adminData.pendingCreditNotes) ? 'danger' : 'default'} failedWhat={failedQueues.get('admin')}>
            {adminData.pendingWriteOffs === 0 && adminData.pendingCreditNotes === 0 ? (
              <Empty text="No write-offs or credit notes waiting on your decision." />
            ) : (
              <>
                {adminData.pendingWriteOffs > 0 && (
                  <WorkItemRow
                    href="/cases?phase=billing"
                    title={`${adminData.pendingWriteOffs} write-off${adminData.pendingWriteOffs !== 1 ? 's' : ''} pending`}
                    reason="Closure would leave a shortfall above the allowed threshold."
                    actionLabel="Resolve"
                  />
                )}
                {adminData.pendingCreditNotes > 0 && (
                  <WorkItemRow
                    href="/admin"
                    title={`${adminData.pendingCreditNotes} credit note${adminData.pendingCreditNotes !== 1 ? 's' : ''} pending`}
                    reason="Post-lock reductions to promised amounts need authorization."
                    actionLabel="Review"
                  />
                )}
              </>
            )}
          </QueueSection>
        )}

        {/* Upcoming collections */}
        {canCollect && (
          <QueueSection title="Upcoming collections — next 14 days" icon={Wallet} count={upcomingTranches.filter(t => daysUntil(t.dueDate) !== null && daysUntil(t.dueDate)! <= 14).length} viewAllHref="/collections" failedWhat={failedQueues.get('tranches')}>
            {upcomingTranches.filter(t => daysUntil(t.dueDate) !== null && daysUntil(t.dueDate)! <= 14).length === 0 ? (
              <Empty text="No payments due in the next 14 days." />
            ) : upcomingTranches.filter(t => daysUntil(t.dueDate) !== null && daysUntil(t.dueDate)! <= 14).slice(0, 6).map((t: TrancheItem, i: number) => {
              const until = daysUntil(t.dueDate)!;
              return (
                <WorkItemRow
                  key={`${t.caseId}-${i}`}
                  href={`/collections`}
                  title={t.caseNumber}
                  party={t.customerName}
                  amount={t.unpaid}
                  reason="Tranche payment expected."
                  dueLabel={until === 0 ? 'Due today' : until === 1 ? 'Due tomorrow' : `Due in ${until}d`}
                />
              );
            })}
          </QueueSection>
        )}

        {/* Recent activity — real last activity, not creation order */}
        <QueueSection title="Recent activity on your cases" icon={Briefcase} count={recentCases.length} viewAllHref="/cases" failedWhat={failedQueues.get('recent')}>
          {recentCases.length === 0 ? <Empty text="No cases yet." /> : recentCases.map((c: CaseRow) => (
            <WorkItemRow
              key={c.id}
              href={`/cases/${c.id}`}
              title={c.case_number}
              party={c.customer?.legal_name}
              amount={c.bill_amount}
              reason={<StatusBadge status={c.status} />}
              meta={`Last activity ${relativeDays(c.updated_at)}`}
            />
          ))}
        </QueueSection>
      </div>

      {/* ── Task board — every task assigned to me, by lifecycle state ─────── */}
      {(myTasks.length > 0 || myDoneTasks.length > 0 || failedQueues.has('myTasks') || failedQueues.has('myDone')) && (
        <section aria-label="My task board" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            My task board
          </h2>
          {failedQueues.has('myTasks') || failedQueues.has('myDone')
            ? <LoadFailed what="your task board" />
            : <TaskKanban openTasks={myTasks} doneTasks={myDoneTasks} />}
        </section>
      )}

      {/* ── Metrics support the queue, never displace it ───────────────────── */}
      {(isRm || isAdmin) && rmMetrics && (
        <section aria-label="Portfolio metrics" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Portfolio metrics {isRm ? '· your cases' : '· all cases'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Outstanding exposure"
              value={metricText(rmMetrics.totalExposure, formatCompactINR)}
              definition={GLOSSARY['Outstanding']}
              scope={`Billing and write-off-pending cases · as of ${metricsAsOf}`}
              href="/collections"
              hrefLabel="View collections"
            />
            <MetricCard
              label="Collection rate (PDCR)"
              value={metricText(rmMetrics.amountPDCR, (n) => `${n.toFixed(1)}%`)}
              definition={[
                GLOSSARY.PDCR,
                pdcrCount != null ? `On time by count: ${pdcrCount.toFixed(0)}%.` : null,
                formatDaysVsPromised(avgDaysVsPromised),
              ].filter(Boolean).join(' ')}
              scope={`All billed cases · as of ${metricsAsOf}`}
              tone={pdcrAmount != null && pdcrAmount < 70 ? 'warning' : 'default'}
            />
            <MetricCard
              label="Collection realisation"
              value={metricText(rmMetrics.collectionRealisation, (n) => `${n.toFixed(1)}%`)}
              definition={GLOSSARY['Collection realisation']}
              scope={`Closed cases · all time · as of ${metricsAsOf}`}
            />
            <MetricCard
              label="Approval success"
              value={metricText(rmMetrics.approvalSuccessRate, (n) => `${Math.round(n)}%`)}
              definition={GLOSSARY['Approval success']}
              scope={`Cases submitted in the last ${METRIC_PERIOD_DAYS} days · as of ${metricsAsOf}`}
              href="/cases?phase=decision"
              hrefLabel="View pending decisions"
            />
          </div>
        </section>
      )}
    </div>
  );
}
