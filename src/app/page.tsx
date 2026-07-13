import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Briefcase, Clock, TrendingUp, Users, ShieldCheck, ArrowRight, Activity, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';

import { BlurText } from '@/components/animations/BlurText';
import { ShinyText } from '@/components/animations/ShinyText';
import { TiltedCard } from '@/components/animations/TiltedCard';
import { StarBorder } from '@/components/animations/StarBorder';
import { SpotlightCard } from '@/components/animations/SpotlightCard';
import { CountUp } from '@/components/animations/CountUp';
import { StaggeredFade } from '@/components/animations/StaggeredFade';

// ── PDCR & Metrics computation (server-side) ─────────────────────────────────

async function computeRmPortfolioMetrics(supabase: any, rmUserId?: string | null) {
  // Fetch all Billing-Active and Closed cases for this RM
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

  // ── Total Active Exposure ─────────────────────────────────────────────────
  const totalExposure = cases
    .filter((c: any) => ['Billing Active', 'Pending Write-Off Approval'].includes(c.status))
    .reduce((sum: number, c: any) => {
      const outstanding = Math.max(0, (c.promised_bill_amount ?? 0) - (c.actual_bill_amount ?? 0));
      return sum + outstanding;
    }, 0);

  // Fetch all repayments for these cases
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

  // ── Margin avg ─────────────────────────────────────────────────────────────
  const marginsForCases = cases
    .filter((c: any) => c.decided_bill_amount && c.decided_bill_amount > 0 && c.actual_bill_amount != null)
    .map((c: any) => ((c.actual_bill_amount / c.decided_bill_amount) - 1) * 100);

  const averageMargin = marginsForCases.length > 0
    ? marginsForCases.reduce((a: number, b: number) => a + b, 0) / marginsForCases.length
    : null;

  // ── Tranche-level PDCR computation ────────────────────────────────────────
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

    // Build tranche schedule
    const trancheSchedule = (c.proposed_tranches as any[]).map((t: any) => {
      const amt = t.type === 'percentage'
        ? Math.round((t.value / 100) * billAmt)
        : Math.round(t.value);
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      return { expectedAmount: amt, dueDate: due, proposedDays: t.days_after_billing ?? 0 };
    });

    // Waterfall allocate repayments to tranches
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

      // Count PDCR: did entire tranche get paid by due date?
      if (fill >= tranche.expectedAmount && lastPaymentDateForTranche && lastPaymentDateForTranche <= tranche.dueDate) {
        tranchesPaidOnTime++;
      }

      // Amount PDCR: proportional amount paid on time
      if (lastPaymentDateForTranche && lastPaymentDateForTranche <= tranche.dueDate) {
        amountPaidOnTime += fill;
      }

      // Weighted Days PDCR: actualDays vs proposedDays
      if (fill > 0 && lastPaymentDateForTranche && billingDate) {
        const actualDaysMs = lastPaymentDateForTranche.getTime() - billingDate.getTime();
        const actualDays = actualDaysMs / (1000 * 3600 * 24);
        if (actualDays > 0 && tranche.proposedDays > 0) {
          const weight = tranche.expectedAmount;
          totalWeightedProposedDays += tranche.proposedDays * weight;
          totalWeightedActualDays   += actualDays * weight;
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

  // ── Approval Success Rate ─────────────────────────────────────────────────
  const { data: statusCounts } = await supabase
    .from('credit_cases')
    .select('status')
    .eq('rm_user_id', rmUserId)
    .not('status', 'eq', 'Draft');

  const totalNonDraft = statusCounts?.length || 0;
  const approvedCount = statusCounts?.filter((c: any) => 
    ['Approved', 'Billing Active', 'Pending Write-Off Approval', 'Closed'].includes(c.status)
  ).length || 0;
  const approvalSuccessRate = totalNonDraft > 0 ? (approvedCount / totalNonDraft) * 100 : 0;

  return { totalExposure, averageMargin, countPDCR, amountPDCR, weightedDaysPDCR, approvalSuccessRate };
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const role = await getImpersonationRole();
  const isRm = role === 'rm';
  const isAdmin = role === 'founder_admin';
  const isKam = role === 'kam';
  const isApprover = role === 'ordinary_approver';
  const isBoardMember = role === 'board_member';

  let queryRecent = supabase.from('credit_cases')
    .select('id, case_number, status, case_scenario, bill_amount, created_at, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (role === 'rm' && user) queryRecent = queryRecent.eq('rm_user_id', user.id);
  if (role === 'kam' && user) queryRecent = queryRecent.eq('kam_user_id', user.id);

  // Fetch notifications for non-RM users
  const queryNotifications = supabase
    .from('notifications')
    .select('id, title, message, is_read, created_at')
    .eq('user_id', user?.id || '')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(5);

  const [
    { data: recentCases },
    { data: userNotifications },
  ] = await Promise.all([
    queryRecent,
    !isRm && user ? queryNotifications : Promise.resolve({ data: null }),
  ]);

  // Fetch upcoming & delayed tranches for RM view
  const upcomingTranches: any[] = [];
  const delayedTranches: any[] = [];
  let rmMetrics: { 
    totalExposure: number; 
    averageMargin: number | null; 
    countPDCR: number | null; 
    amountPDCR: number | null; 
    weightedDaysPDCR: number | null;
    approvalSuccessRate: number | null;
  } | null = null;

  if ((role === 'rm' || isAdmin) && user) {
    rmMetrics = await computeRmPortfolioMetrics(supabase, role === 'rm' ? user.id : null);

    // Fetch billing-active cases with their tranches
    let activeQuery = supabase
      .from('credit_cases')
      .select('id, case_number, billing_date, decided_bill_amount, actual_bill_amount, proposed_tranches, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
      .in('status', ['Billing Active', 'Pending Write-Off Approval']);

    if (role === 'rm') {
      activeQuery = activeQuery.eq('rm_user_id', user.id);
    }
    const { data: activeCases } = await activeQuery;

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

        const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 3600 * 24));
        const trancheItem = {
          caseId: c.id,
          caseNumber: c.case_number,
          customerName: (c.customer as any)?.legal_name ?? '—',
          dueDate: due,
          unpaid,
          daysOverdue,
        };

        if (due < now) {
          delayedTranches.push(trancheItem);
        } else {
          upcomingTranches.push(trancheItem);
        }
      }
    }
    upcomingTranches.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    delayedTranches.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  
  // --- 5A KAM Data ---
  let kamData: { awaitingAction: any[]; pendingApproval: any[]; billingActive: any[]; } | null = null;
  if (isKam && user) {
    const [awaitingRes, approvalRes, billingRes] = await Promise.all([
      supabase.from('credit_cases').select('id, case_number, status, bill_amount, created_at, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
        .eq('kam_user_id', user.id).in('status', ['In Review', 'Awaiting Input']).order('created_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select('id, case_number, status, bill_amount, created_at, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
        .eq('kam_user_id', user.id).in('status', ['Awaiting Approval', 'Appealed']).order('created_at', { ascending: false }).limit(10),
      supabase.from('credit_cases').select('id, case_number, status, bill_amount, billing_date, decided_bill_amount, actual_bill_amount, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
        .eq('kam_user_id', user.id).in('status', ['Billing Active', 'Pending Write-Off Approval']).order('billing_date', { ascending: true }).limit(20),
    ]);
    kamData = { awaitingAction: awaitingRes.data || [], pendingApproval: approvalRes.data || [], billingActive: billingRes.data || [] };
  }

  // --- 5B Approver Data ---
  let approverData: { pendingRounds: any[] } | null = null;
  if (isApprover && user) {
    const { data: pendingDecisions } = await supabase.from('approval_rounds')
      .select('id, stage, round_type, created_at, review_cycle:review_cycles!approval_rounds_review_cycle_id_fkey(case:credit_cases!review_cycles_case_id_fkey(id, case_number, bill_amount, customer:parties!credit_cases_customer_party_id_fkey(legal_name))), my_decision:approval_decisions!approval_rounds_id_fkey(decision)')
      .eq('status', 'open').limit(20);
    approverData = {
      pendingRounds: (pendingDecisions || []).filter((r: any) => {
        const myDecisions = r.my_decision || [];
        return !myDecisions.some((d: any) => d.approver_id === user.id);
      }),
    };
  }

  // --- 5C Board Data ---
  let boardData: { openVotes: any[] } | null = null;
  if (isBoardMember && user) {
    const { data: openVotes } = await supabase.from('board_rounds')
      .select('id, vote_window_end, approval_round:approval_rounds!board_rounds_approval_round_id_fkey(review_cycle:review_cycles!approval_rounds_review_cycle_id_fkey(case:credit_cases!review_cycles_case_id_fkey(id, case_number, bill_amount, customer:parties!credit_cases_customer_party_id_fkey(legal_name))))')
      .eq('status', 'open').gt('vote_window_end', new Date().toISOString()).limit(10);
    boardData = { openVotes: openVotes || [] };
  }

  // --- 5D Admin Data ---
  let adminData: { pendingCreditNotes: number; pendingWriteOffs: number; recentImports: any[] } | null = null;
  if (isAdmin) {
    const [creditNotesRes, writeOffsRes, importsRes] = await Promise.all([
      supabase.from('credit_notes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('credit_cases').select('id', { count: 'exact', head: true }).eq('status', 'Pending Write-Off Approval'),
      supabase.from('import_jobs').select('id, import_type, status, records_total, records_failed, created_at').order('created_at', { ascending: false }).limit(3),
    ]);
    adminData = {
      pendingCreditNotes: creditNotesRes.count || 0,
      pendingWriteOffs: writeOffsRes.count || 0,
      recentImports: importsRes.data || [],
    };
  }

  const statusBadge = (status: string) => {
    const map: Record<string, any> = {
      'Draft': 'secondary', 'In Review': 'warning', 'Awaiting Approval': 'warning',
      'Approved': 'success', 'Rejected': 'destructive', 'Withdrawn': 'secondary',
      'Billing Active': 'info', 'Pending Write-Off Approval': 'warning', 'Closed': 'success',
    };
    return <Badge variant={map[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          <BlurText text="Dashboard" />
        </h1>
        <p className="text-muted-foreground text-sm flex items-center gap-2">
          <Activity size={14} className="text-brand" aria-hidden="true" />
          <ShinyText text="Credit Issuance System Overview" />
        </p>
      </div>

      {/* Bento grid: responsive sizing for 1920×1080@150% (1280px) → 3-col, normal display → 4-col */}
      <StaggeredFade className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-max">
        
        {/* 1. Portfolio Overview (2×1) — responsive: 2 cols at 3-col layout, 2 cols at 4-col */}
        {(isRm || isAdmin) && (
          <SpotlightCard className="col-span-1 md:col-span-2 lg:col-span-2 bg-card/70 backdrop-blur-md border-white/20 hover:scale-[1.01] transition-all">
            <div className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-tiny font-bold uppercase tracking-widest text-muted-foreground">Portfolio Overview</span>
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Briefcase size={20} className="text-brand" aria-hidden="true" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-bold text-foreground">
                  <CountUp to={rmMetrics?.totalExposure || 0} prefix="₹" />
                </p>
                <p className="text-sm text-muted-foreground">Total Outstanding Exposure</p>
              </div>
              <div className="mt-6 pt-6 border-t border-border/50 flex gap-8">
                <div>
                  <p className="text-tiny font-bold uppercase tracking-widest text-muted-foreground mb-1">PDCR</p>
                  <p className="text-xl font-bold text-success">
                    {rmMetrics?.amountPDCR != null
                      ? <CountUp to={rmMetrics.amountPDCR} suffix="%" />
                      : <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                <div>
                  <p className="text-tiny font-bold uppercase tracking-widest text-muted-foreground mb-1">Avg Margin</p>
                  {rmMetrics?.averageMargin != null ? (
                    <p className={cn("text-xl font-bold", rmMetrics.averageMargin >= 0 ? "text-success" : "text-destructive")}>
                      {rmMetrics.averageMargin >= 0 ? '+' : ''}
                      <CountUp to={Math.abs(rmMetrics.averageMargin)} decimals={2} suffix="%" />
                    </p>
                  ) : (
                    <p className="text-xl font-bold text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            </div>
          </SpotlightCard>
        )}

        {/* 2. Urgent Collections (1x1) */}
        {(isRm || isAdmin) && (
          <SpotlightCard className="bg-warning/10 backdrop-blur-md border-warning/20 hover:scale-[1.01] transition-all">
            <div className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-tiny font-bold uppercase tracking-widest text-warning">Urgent</span>
                <Clock size={18} className="text-warning" aria-hidden="true" />
              </div>
              <div className="mt-4">
                <p className="text-5xl font-bold text-warning">
                  <CountUp to={delayedTranches.length} />
                </p>
                <p className="text-sm font-medium text-warning/80 mt-1">Delayed Payments</p>
              </div>
              <Link href="/cases" className="text-xs font-semibold text-warning flex items-center gap-1 hover:underline mt-4">
                Take Action <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
          </SpotlightCard>
        )}

        {/* 3. Quick Shortcuts (1x1) */}
        <div className={cn("grid grid-rows-2 gap-4", !isRm && "col-span-1 md:col-span-1")}>
          <Link href="/cases/new" className="group h-full">
            <StarBorder className="h-full w-full">
              <div className="h-full w-full bg-brand text-brand-foreground hover:bg-brand/90 transition-all flex items-center justify-center p-4">
                <div className="text-center space-y-1">
                  <Plus size={24} className="mx-auto group-hover:rotate-90 transition-transform duration-300" aria-hidden="true" />
                  <p className="text-tiny font-bold uppercase tracking-widest">New Case</p>
                </div>
              </div>
            </StarBorder>
          </Link>
          <Link href="/policy" className="h-full">
            <StarBorder className="h-full w-full">
              <div className="h-full w-full bg-card/70 backdrop-blur-md border-white/20 hover:bg-accent transition-all flex items-center justify-center p-4">
                <div className="text-center space-y-1">
                  <ShieldCheck size={24} className="mx-auto text-brand" aria-hidden="true" />
                  <p className="text-tiny font-bold uppercase tracking-widest text-muted-foreground">Policy</p>
                </div>
              </div>
            </StarBorder>
          </Link>
        </div>

        {/* 3.5. My Tasks — for non-RM users only */}
        {!isRm && (
          <SpotlightCard className="col-span-1 md:col-span-1 lg:col-span-1 row-span-2 bg-brand/5 backdrop-blur-md border-brand/20 hover:scale-[1.005] transition-all">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-brand" aria-hidden="true" />
                My Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {!userNotifications || userNotifications.length === 0 ? (
                <p className="text-xs text-muted-foreground">All caught up!</p>
              ) : (
                <div className="space-y-2">
                  {userNotifications.slice(0, 4).map((n: any) => (
                    <div key={n.id} className="p-2 text-xs border-l-2 border-brand/40 bg-brand/10 rounded">
                      <p className="font-medium text-foreground line-clamp-1">{n.title}</p>
                      <p className="text-muted-foreground text-tiny line-clamp-2 mt-0.5">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </SpotlightCard>
        )}

        {/* 4. Recent Activity (2×2 for RM, wider for Others) */}
        <SpotlightCard className={cn("row-span-2 bg-card/70 backdrop-blur-md border-white/20 hover:scale-[1.005] transition-all", isRm ? "col-span-1 md:col-span-2 lg:col-span-2" : "col-span-1 md:col-span-1 lg:col-span-2")}>
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity size={16} className="text-brand" aria-hidden="true" />
                Recent Case Activity
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/cases" className="text-tiny font-bold uppercase tracking-widest">All Cases</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 px-0">
            {(recentCases || []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No cases yet</p>
            ) : (recentCases || []).map((c: any) => (
              <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between py-3 px-6 hover:bg-brand/5 transition-colors border-b border-border/30 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{c.case_number}</p>
                  <p className="text-tiny text-muted-foreground">{(c.customer as any)?.legal_name || '—'}</p>
                </div>
                {statusBadge(c.status)}
              </Link>
            ))}
          </CardContent>
        </SpotlightCard>

        {/* 5. Efficiency Funnel (2×1) */}
        {(isRm || isAdmin) && (
          <SpotlightCard className="col-span-1 md:col-span-2 lg:col-span-2 bg-card/70 backdrop-blur-md border-white/20 p-6 hover:scale-[1.01] transition-all">
            <div className="flex items-center justify-between mb-6">
              <span className="text-tiny font-bold uppercase tracking-widest text-muted-foreground">Efficiency Funnel</span>
              <TrendingUp size={18} className="text-success" aria-hidden="true" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Approval Success Rate</span>
                  <span className="text-foreground font-bold">
                    <CountUp to={Math.round(rmMetrics?.approvalSuccessRate || 0)} suffix="%" />
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(rmMetrics?.approvalSuccessRate || 0)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-success rounded-full" style={{ width: `${Math.round(rmMetrics?.approvalSuccessRate || 0)}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">PDCR (Amount)</span>
                  <span className="text-foreground font-bold">
                    {rmMetrics?.amountPDCR != null
                      ? <CountUp to={rmMetrics.amountPDCR} decimals={1} suffix="%" />
                      : '—'}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={rmMetrics?.amountPDCR ?? 0} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-brand" style={{ width: `${rmMetrics?.amountPDCR ?? 0}%` }} />
                </div>
              </div>
            </div>
          </SpotlightCard>
        )}

        

        {/* --- KAM DASHBOARD --- */}
        {isKam && (
          <SpotlightCard className="col-span-1 md:col-span-2 lg:col-span-2 bg-card/70 backdrop-blur-md border-white/20 hover:scale-[1.01] transition-all">
            <CardHeader className="pb-2 border-b border-border/50 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertCircle size={16} className="text-warning" aria-hidden="true" />
                Cases Needing Attention
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/cases?status=In+Review" className="text-tiny font-bold uppercase tracking-widest text-warning">View All</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-4 px-0 space-y-4">
              <div className="px-6 flex gap-4 text-center">
                <div className="flex-1 bg-muted rounded-md p-3">
                  <p className="text-2xl font-bold text-foreground">{kamData?.awaitingAction.length || 0}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Awaiting Action</p>
                </div>
                <div className="flex-1 bg-muted rounded-md p-3">
                  <p className="text-2xl font-bold text-foreground">{kamData?.pendingApproval.length || 0}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Pending Approval</p>
                </div>
              </div>
              <div className="px-0">
                {(kamData?.awaitingAction || []).slice(0, 3).map((c: any) => (
                  <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between py-2 px-6 hover:bg-brand/5 transition-colors border-b border-border/30 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{c.case_number}</p>
                      <p className="text-tiny text-muted-foreground">{(c.customer as any)?.legal_name || '—'}</p>
                    </div>
                    {statusBadge(c.status)}
                  </Link>
                ))}
              </div>
            </CardContent>
          </SpotlightCard>
        )}

        {isKam && (
          <SpotlightCard className="col-span-1 md:col-span-1 lg:col-span-2 bg-warning/10 backdrop-blur-md border-warning/20 hover:scale-[1.01] transition-all">
            <div className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-tiny font-bold uppercase tracking-widest text-warning">Active Collections</span>
                <Clock size={18} className="text-warning" aria-hidden="true" />
              </div>
              <div className="mt-4">
                <p className="text-4xl font-bold text-warning">
                  <CountUp to={kamData?.billingActive.reduce((sum, c) => sum + Math.max(0, (c.decided_bill_amount || 0) - (c.actual_bill_amount || 0)), 0) || 0} prefix="₹" />
                </p>
                <p className="text-sm font-medium text-warning/80 mt-1">{kamData?.billingActive.length || 0} Cases in Billing</p>
              </div>
              <Link href="/collections" className="text-xs font-semibold text-warning flex items-center gap-1 hover:underline mt-4">
                Manage Collections <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
          </SpotlightCard>
        )}

        {/* --- APPROVER DASHBOARD --- */}
        {isApprover && (
          <SpotlightCard className="col-span-1 md:col-span-2 lg:col-span-2 bg-card/70 backdrop-blur-md border-white/20 hover:scale-[1.01] transition-all">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand" aria-hidden="true" />
                Pending Your Vote
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              {(approverData?.pendingRounds || []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No pending approvals</p>
              ) : (approverData?.pendingRounds || []).map((r: any) => {
                const c = (r.review_cycle as any)?.case;
                return (
                  <Link key={r.id} href={`/cases/${c?.id}`} className="flex items-center justify-between py-3 px-6 hover:bg-brand/5 transition-colors border-b border-border/30 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{c?.case_number || 'Unknown'}</p>
                      <p className="text-tiny text-muted-foreground">{(c?.customer as any)?.legal_name || '—'} · ₹{(c?.bill_amount || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <Badge variant="warning">Stage {r.stage}</Badge>
                  </Link>
                );
              })}
            </CardContent>
          </SpotlightCard>
        )}

        {/* --- BOARD MEMBER DASHBOARD --- */}
        {isBoardMember && (
          <SpotlightCard className="col-span-1 md:col-span-2 lg:col-span-2 bg-card/70 backdrop-blur-md border-white/20 hover:scale-[1.01] transition-all">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users size={16} className="text-brand" aria-hidden="true" />
                Open Board Votes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              {(boardData?.openVotes || []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No active board votes</p>
              ) : (boardData?.openVotes || []).map((v: any) => {
                const c = (v.approval_round as any)?.review_cycle?.case;
                return (
                  <Link key={v.id} href={`/cases/${c?.id}/board`} className="flex items-center justify-between py-3 px-6 hover:bg-brand/5 transition-colors border-b border-border/30 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{c?.case_number || 'Unknown'}</p>
                      <p className="text-tiny text-muted-foreground">Deadline: {new Date(v.vote_window_end).toLocaleDateString('en-IN')}</p>
                    </div>
                    <Badge variant="warning">Vote Open</Badge>
                  </Link>
                );
              })}
            </CardContent>
          </SpotlightCard>
        )}

        {/* --- ADMIN DASHBOARD --- */}
        {isAdmin && (
          <SpotlightCard className="col-span-1 md:col-span-3 lg:col-span-4 bg-card/70 backdrop-blur-md border-white/20 hover:scale-[1.005] transition-all mb-4">
             <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/50">
                <div className="p-6 text-center">
                  <p className="text-3xl font-bold text-foreground">{adminData?.pendingCreditNotes || 0}</p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Pending Credit Notes</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-3xl font-bold text-warning">{adminData?.pendingWriteOffs || 0}</p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Pending Write-Offs</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-3xl font-bold text-info">{adminData?.recentImports.filter((i: any) => i.status === 'processing').length || 0}</p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Active Imports</p>
                </div>
             </div>
          </SpotlightCard>
        )}


        {/* 6. Quick Actions — only admin users see System Audit & Admin Panel */}
        {isAdmin && (
          <div className={cn("grid grid-cols-2 gap-4", isRm ? "col-span-1 md:col-span-2 lg:col-span-2" : "col-span-1 md:col-span-3 lg:col-span-4")}>
            {[
              { label: 'System Audit', href: '/audit', icon: ShieldCheck, iconColor: 'text-info', bg: 'bg-info/10' },
              { label: 'Admin Panel', href: '/admin', icon: Users, iconColor: 'text-brand', bg: 'bg-brand/10' },
            ].map((action, i) => (
              <Link key={i} href={action.href}>
                <SpotlightCard className="h-full hover:bg-accent transition-all p-4 border-white/20 bg-card/70 backdrop-blur-md flex items-center gap-3 hover:scale-[1.02]">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", action.bg)}>
                    <action.icon size={18} className={action.iconColor} aria-hidden="true" />
                  </div>
                  <span className="text-tiny font-bold uppercase tracking-widest text-foreground">{action.label}</span>
                </SpotlightCard>
              </Link>
            ))}
          </div>
        )}

      </StaggeredFade>
    </div>
  );
}
