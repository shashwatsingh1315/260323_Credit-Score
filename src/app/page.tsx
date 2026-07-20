import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import {
  Briefcase, PlusCircle, Wallet, ShieldCheck, FileEdit, Undo2, BadgeCheck,
  ClipboardList, Hourglass, Scale, AlertTriangle, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';
import { MetricCard } from '@/components/creditflow/MetricCard';
import { TaskKanban } from '@/components/creditflow/TaskKanban';
import { WorkItemRow } from '@/components/creditflow/WorkItemRow';
import { StatusBadge } from '@/components/creditflow/StatusBadge';
import { formatCompactINR, relativeDays, daysUntil } from '@/lib/format';
import { ROLE_LABELS, GLOSSARY } from '@/lib/vocabulary';

// ── PDCR & Metrics computation (server-side) ─────────────────────────────────

async function computeRmPortfolioMetrics(supabase: any, rmUserId?: string | null) {
  let query = supabase
    .from('credit_cases')
    .select('id, decided_bill_amount, promised_bill_amount, actual_bill_amount, proposed_tranches, billing_date, status')
    .in('status', ['Billing Active', 'Pending Write-Off Approval', 'Closed', 'Cancelled']);

  if (rmUserId) {
    query = query.eq('rm_user_id', rmUserId);
  }
  const { data: cases } = await query;

  if (!cases || cases.length === 0) {
    return { totalExposure: 0, averageMargin: null, countPDCR: null, amountPDCR: null, weightedDaysPDCR: null, approvalSuccessRate: null };
  }

  const totalExposure = cases
    .filter((c: any) => ['Billing Active', 'Pending Write-Off Approval'].includes(c.status))
    .reduce((sum: number, c: any) => {
      const outstanding = Math.max(0, (c.promised_bill_amount ?? 0) - (c.actual_bill_amount ?? 0));
      return sum + outstanding;
    }, 0);

  const caseIds = cases.map((c: any) => c.id);
  const { data: allRepayments } = await supabase
    .from('repayments')
    .select('case_id, amount, payment_date')
    .in('case_id', caseIds)
    .order('case_id')
    .order('created_at', { ascending: true });

  const repaymentsByCaseId = (allRepayments ?? []).reduce((acc: any, r: any) => {
    if (!acc[r.case_id]) acc[r.case_id] = [];
    acc[r.case_id].push(r);
    return acc;
  }, {} as Record<string, any[]>);

  const marginsForCases = cases
    .filter((c: any) => c.decided_bill_amount && c.decided_bill_amount > 0 && c.actual_bill_amount != null)
    .map((c: any) => ((c.actual_bill_amount / c.decided_bill_amount) - 1) * 100);

  const averageMargin = marginsForCases.length > 0
    ? marginsForCases.reduce((a: number, b: number) => a + b, 0) / marginsForCases.length
    : null;

  let totalTranches = 0;
  let tranchesPaidOnTime = 0;
  let totalAmount = 0;
  let amountPaidOnTime = 0;
  let totalWeightedProposedDays = 0;
  let totalWeightedActualDays = 0;

  for (const c of cases) {
    if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) continue;

    const billingDate = new Date(c.billing_date);
    const billAmt = c.decided_bill_amount;
    const repayments: { amount: number; payment_date: string }[] = repaymentsByCaseId[c.id] ?? [];

    const trancheSchedule = (c.proposed_tranches as any[]).map((t: any) => {
      const amt = t.type === 'percentage'
        ? Math.round((t.value / 100) * billAmt)
        : Math.round(t.value);
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      return { expectedAmount: amt, dueDate: due, proposedDays: t.days_after_billing ?? 0 };
    });

    const sortedRepayments = [...repayments].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
    let repIdx = 0;
    let repRemaining = sortedRepayments.length > 0 ? sortedRepayments[0].amount : 0;

    for (const tranche of trancheSchedule) {
      let trancheRemaining = tranche.expectedAmount;
      let lastPaymentDateForTranche: Date | null = null;

      while (trancheRemaining > 0 && repIdx < sortedRepayments.length) {
        const curRep = sortedRepayments[repIdx];
        const fillAmount = Math.min(trancheRemaining, repRemaining);

        trancheRemaining -= fillAmount;
        repRemaining -= fillAmount;
        lastPaymentDateForTranche = new Date(curRep.payment_date);

        if (repRemaining <= 0) {
          repIdx++;
          if (repIdx < sortedRepayments.length) {
            repRemaining = sortedRepayments[repIdx].amount;
          }
        }
      }

      totalTranches++;
      totalAmount += tranche.expectedAmount;
      const fill = tranche.expectedAmount - trancheRemaining;

      if (fill >= tranche.expectedAmount && lastPaymentDateForTranche && lastPaymentDateForTranche <= tranche.dueDate) {
        tranchesPaidOnTime++;
      }

      if (lastPaymentDateForTranche && lastPaymentDateForTranche <= tranche.dueDate) {
        amountPaidOnTime += fill;
      }

      if (fill > 0 && lastPaymentDateForTranche && billingDate) {
        const actualDaysMs = lastPaymentDateForTranche.getTime() - billingDate.getTime();
        const actualDays = actualDaysMs / (1000 * 3600 * 24);
        if (actualDays > 0 && tranche.proposedDays > 0) {
          const weight = tranche.expectedAmount;
          totalWeightedProposedDays += tranche.proposedDays * weight;
          totalWeightedActualDays += actualDays * weight;
        }
      }
    }
  }

  const countPDCR = totalTranches > 0
    ? Math.min(100, (tranchesPaidOnTime / totalTranches) * 100)
    : null;

  const amountPDCR = totalAmount > 0
    ? Math.min(100, (amountPaidOnTime / totalAmount) * 100)
    : null;

  const weightedDaysPDCR = totalWeightedProposedDays > 0
    ? Math.min(100, (totalWeightedActualDays / totalWeightedProposedDays) * 100)
    : null;

  const { data: statusCounts } = await supabase
    .from('credit_cases')
    .select('status')
    .eq('rm_user_id', rmUserId)
    .not('status', 'eq', 'Draft');

  const totalNonDraft = statusCounts?.length || 0;
  const approvedCount = statusCounts?.filter((c: any) =>
    ['Approved', 'Billing Active', 'Pending Write-Off Approval', 'Closed'].includes(c.status)
  ).length || 0;
  // null (not 0) when there are no non-draft cases — "0%" would imply failures
  const approvalSuccessRate = totalNonDraft > 0 ? (approvedCount / totalNonDraft) * 100 : null;

  return { totalExposure, averageMargin, countPDCR, amountPDCR, weightedDaysPDCR, approvalSuccessRate };
}

// ── Tranche helpers ───────────────────────────────────────────────────────────

function computeTrancheQueue(activeCases: any[]) {
  const upcoming: any[] = [];
  const delayed: any[] = [];
  const now = new Date();

  for (const c of activeCases ?? []) {
    if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) continue;
    const billingDate = new Date(c.billing_date);
    let remaining = c.actual_bill_amount ?? 0;

    for (const t of c.proposed_tranches as any[]) {
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
        customerName: (c.customer as any)?.legal_name ?? '—',
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

function QueueSection({ title, icon: Icon, count, children, viewAllHref, tone = 'default' }: any) {
  return (
    <Card className={tone === 'danger' ? 'border-destructive/30' : ''}>
      <CardHeader className="pb-0 pt-4 px-4 sm:px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icon size={15} className={tone === 'danger' ? 'text-destructive' : 'text-primary'} aria-hidden="true" />
            {title}
            <span className="text-muted-foreground font-normal">({count})</span>
          </CardTitle>
          {viewAllHref && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={viewAllHref} className="text-tiny font-semibold uppercase tracking-wider">View all</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 mt-2">{children}</CardContent>
    </Card>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="px-5 py-6 text-sm text-muted-foreground">{text}</p>
);

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
    : Promise.resolve({ data: [] });

  // Recently finished tasks feed the "Done" column of the task board.
  const doneCutoff = new Date(Date.now() - 14 * 86400000).toISOString();
  const doneTasksQuery = user
    ? supabase.from('stage_tasks')
      .select(taskSelect)
      .eq('assigned_to', user.id)
      .in('status', ['Completed', 'Waived'])
      .gte('completed_at', doneCutoff)
      .order('completed_at', { ascending: false })
      .limit(20)
    : Promise.resolve({ data: [] });

  const [recentRes, myTasksRes, doneTasksRes] = await Promise.all([recentQuery, myTasksQuery, doneTasksQuery]);
  const recentCases = recentRes.data || [];
  const toKanban = (rows: any[]) => rows
    .filter((t: any) => t.review_cycle?.case?.id)
    .map((t: any) => ({ ...t, case: t.review_cycle.case }));
  const myTasks = toKanban(myTasksRes.data || []);
  const myDoneTasks = toKanban(doneTasksRes.data || []);

  // ── Role queues ────────────────────────────────────────────────────────────
  let rmDrafts: any[] = [], rmReturned: any[] = [], rmApproved: any[] = [];
  let kamAwaiting: any[] = [], kamDecision: any[] = [], kamUnassigned: any[] = [];
  let approverRounds: any[] = [], boardVotes: any[] = [];
  let delayedTranches: any[] = [], upcomingTranches: any[] = [];
  let rmMetrics: any = null;
  let adminData: { pendingCreditNotes: number; pendingWriteOffs: number } | null = null;

  if (isRm && user) {
    const [draftsRes, returnedRes, approvedRes] = await Promise.all([
      supabase.from('credit_cases').select(caseSelect).eq('rm_user_id', user.id).eq('status', 'Draft').order('updated_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select(caseSelect).eq('rm_user_id', user.id).eq('status', 'In Review').eq('substatus', 'Returned for revision').order('updated_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select(caseSelect).eq('rm_user_id', user.id).eq('status', 'Approved').order('updated_at', { ascending: false }).limit(10),
    ]);
    rmDrafts = draftsRes.data || [];
    rmReturned = returnedRes.data || [];
    rmApproved = approvedRes.data || [];
  }

  if (isKam && user) {
    const [awaitingRes, decisionRes, unassignedRes] = await Promise.all([
      supabase.from('credit_cases').select(caseSelect).eq('kam_user_id', user.id).in('status', ['In Review', 'Awaiting Input']).order('updated_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select(caseSelect).eq('kam_user_id', user.id).in('status', ['Awaiting Approval', 'Appealed']).order('updated_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select(caseSelect).is('kam_user_id', null).in('status', ['In Review', 'Awaiting Input']).order('created_at', { ascending: false }).limit(10),
    ]);
    kamAwaiting = awaitingRes.data || [];
    kamDecision = decisionRes.data || [];
    kamUnassigned = unassignedRes.data || [];
  }

  if (isApprover && user) {
    const { data: pendingDecisions } = await supabase.from('approval_rounds')
      .select('id, stage, round_type, created_at, review_cycle:review_cycles!approval_rounds_review_cycle_id_fkey(case:credit_cases!review_cycles_case_id_fkey(id, case_number, bill_amount, requested_exposure_amount, customer:parties!credit_cases_customer_party_id_fkey(legal_name))), my_decision:approval_decisions!approval_decisions_approval_round_id_fkey(decision, approver_id)')
      .eq('status', 'open').order('created_at', { ascending: true }).limit(20);
    approverRounds = (pendingDecisions || []).filter((r: any) => {
      const mine = (r.my_decision || []).filter((d: any) => d.approver_id === user.id);
      return mine.length === 0;
    });
  }

  if (isBoardMember && user) {
    const { data: openVotes } = await supabase.from('board_rounds')
      .select('id, vote_window_end, approval_round:approval_rounds!board_rounds_approval_round_id_fkey(round_type, review_cycle:review_cycles!approval_rounds_review_cycle_id_fkey(case:credit_cases!review_cycles_case_id_fkey(id, case_number, bill_amount, customer:parties!credit_cases_customer_party_id_fkey(legal_name))))')
      .eq('status', 'open').gt('vote_window_end', new Date().toISOString()).order('vote_window_end', { ascending: true }).limit(10);
    boardVotes = openVotes || [];
  }

  if (canCollect && user) {
    let activeQuery = supabase
      .from('credit_cases')
      .select('id, case_number, billing_date, decided_bill_amount, actual_bill_amount, proposed_tranches, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
      .in('status', ['Billing Active', 'Pending Write-Off Approval']);
    if (isRm) activeQuery = activeQuery.eq('rm_user_id', user.id);
    if (isKam) activeQuery = activeQuery.eq('kam_user_id', user.id);
    const { data: activeCases } = await activeQuery;
    const q = computeTrancheQueue(activeCases || []);
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
  }

  const todayIST = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

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
            <QueueSection title="Returned for revision" icon={Undo2} count={rmReturned.length} tone={rmReturned.length ? 'danger' : 'default'}>
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

            <QueueSection title="Incomplete drafts" icon={FileEdit} count={rmDrafts.length}>
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

            <QueueSection title="Approved — awaiting negotiation" icon={BadgeCheck} count={rmApproved.length}>
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
            <QueueSection title="Unassigned new cases" icon={Users} count={kamUnassigned.length} tone={kamUnassigned.length ? 'danger' : 'default'}>
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

            <QueueSection title="In review — your cases" icon={ClipboardList} count={kamAwaiting.length} viewAllHref="/cases?phase=review">
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

            <QueueSection title="Ready for decision" icon={Hourglass} count={kamDecision.length} viewAllHref="/cases?phase=decision">
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
          <QueueSection title="Decisions due from you" icon={Hourglass} count={approverRounds.length} viewAllHref="/cases?phase=decision">
            {approverRounds.length === 0 ? <Empty text="No open decision rounds need your vote." /> : approverRounds.map((r: any) => {
              const c = r.review_cycle?.case;
              return (
                <WorkItemRow
                  key={r.id}
                  href={`/cases/${c?.id}`}
                  title={c?.case_number || 'Unknown case'}
                  party={c?.customer?.legal_name}
                  amount={c?.requested_exposure_amount || c?.bill_amount}
                  reason={`${r.round_type === 'appeal' ? 'Appeal' : `Stage ${r.stage} decision`} — review the decision brief.`}
                  dueLabel={`Waiting ${relativeDays(r.created_at)}`}
                  actionLabel="Review and decide"
                />
              );
            })}
          </QueueSection>
        )}

        {/* Board queue */}
        {isBoardMember && (
          <QueueSection title="Board ballots open" icon={Scale} count={boardVotes.length}>
            {boardVotes.length === 0 ? <Empty text="No open board votes." /> : boardVotes.map((v: any) => {
              const ar = v.approval_round;
              const c = ar?.review_cycle?.case;
              const until = daysUntil(v.vote_window_end);
              return (
                <WorkItemRow
                  key={v.id}
                  href={`/cases/${c?.id}/board`}
                  title={c?.case_number || 'Unknown case'}
                  party={c?.customer?.legal_name}
                  amount={c?.bill_amount}
                  reason={`${ar?.round_type === 'appeal' ? 'Appeal' : 'Ambiguity review'} — independent ballot. Other votes stay hidden until the window closes.`}
                  dueLabel={until !== null ? (until < 0 ? 'Window closed' : until === 0 ? 'Closes today' : `Closes in ${until}d`) : null}
                  overdue={until !== null && until < 0}
                  actionLabel="Cast your vote"
                />
              );
            })}
          </QueueSection>
        )}

        {/* Admin exceptions */}
        {isAdmin && adminData && (
          <QueueSection title="Exceptions needing your authority" icon={AlertTriangle} count={adminData.pendingWriteOffs + adminData.pendingCreditNotes} tone={(adminData.pendingWriteOffs + adminData.pendingCreditNotes) ? 'danger' : 'default'}>
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
          <QueueSection title="Upcoming collections — next 14 days" icon={Wallet} count={upcomingTranches.filter(t => daysUntil(t.dueDate) !== null && daysUntil(t.dueDate)! <= 14).length} viewAllHref="/collections">
            {upcomingTranches.filter(t => daysUntil(t.dueDate) !== null && daysUntil(t.dueDate)! <= 14).length === 0 ? (
              <Empty text="No payments due in the next 14 days." />
            ) : upcomingTranches.filter(t => daysUntil(t.dueDate) !== null && daysUntil(t.dueDate)! <= 14).slice(0, 6).map((t: any, i: number) => {
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
        <QueueSection title="Recent activity on your cases" icon={Briefcase} count={recentCases.length} viewAllHref="/cases">
          {recentCases.length === 0 ? <Empty text="No cases yet." /> : recentCases.map((c: any) => (
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
      {(myTasks.length > 0 || myDoneTasks.length > 0) && (
        <section aria-label="My task board" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            My task board
          </h2>
          <TaskKanban openTasks={myTasks} doneTasks={myDoneTasks} />
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
              value={formatCompactINR(rmMetrics.totalExposure)}
              definition={GLOSSARY['Outstanding']}
              scope="Billing-active cases · now"
              href="/collections"
              hrefLabel="View collections"
            />
            <MetricCard
              label="Collection rate (PDCR)"
              value={rmMetrics.amountPDCR != null ? `${rmMetrics.amountPDCR.toFixed(1)}%` : 'Not available'}
              definition={GLOSSARY.PDCR}
              scope="Billed and closed cases"
              tone={rmMetrics.amountPDCR != null && rmMetrics.amountPDCR < 70 ? 'warning' : 'default'}
            />
            <MetricCard
              label="Average margin"
              value={rmMetrics.averageMargin != null ? `${rmMetrics.averageMargin >= 0 ? '+' : ''}${rmMetrics.averageMargin.toFixed(2)}%` : 'Not available'}
              definition="Collected amount vs decided bill amount, averaged across cases."
              scope="Cases with recorded collections"
              tone={rmMetrics.averageMargin != null && rmMetrics.averageMargin < 0 ? 'danger' : 'default'}
            />
            <MetricCard
              label="Approval success"
              value={rmMetrics.approvalSuccessRate != null ? `${Math.round(rmMetrics.approvalSuccessRate)}%` : 'Not available'}
              definition="Share of submitted cases that reached approval or billing."
              scope="Non-draft cases"
              href="/cases?phase=decision"
              hrefLabel="View pending decisions"
            />
          </div>
        </section>
      )}
    </div>
  );
}
