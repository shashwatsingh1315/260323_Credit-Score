import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Briefcase, Clock, TrendingUp, Users, ShieldCheck, ArrowRight, Activity, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';

import { BlurText } from '@/components/animations/BlurText';
import { SpotlightCard } from '@/components/animations/SpotlightCard';
import { CountUp } from '@/components/animations/CountUp';
import { StaggeredFade } from '@/components/animations/StaggeredFade';

// ── PDCR & Metrics computation (server-side) ─────────────────────────────────

async function computeRmPortfolioMetrics(supabase: any, rmUserId: string) {
  // Fetch all Billing-Active and Closed cases for this RM
  const { data: cases } = await supabase
    .from('credit_cases')
    .select('id, decided_bill_amount, promised_bill_amount, actual_bill_amount, proposed_tranches, billing_date, status')
    .eq('rm_user_id', rmUserId)
    .in('status', ['Billing Active', 'Pending Write-Off Approval', 'Closed', 'Cancelled']);

  if (!cases || cases.length === 0) {
    return { totalExposure: 0, averageMargin: null, countPDCR: null, amountPDCR: null, weightedDaysPDCR: null };
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

  return { totalExposure, averageMargin, countPDCR, amountPDCR, weightedDaysPDCR };
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const role = await getImpersonationRole();

  let queryRecent = supabase.from('credit_cases')
    .select('id, case_number, status, case_scenario, bill_amount, created_at, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (role === 'rm' && user) queryRecent = queryRecent.eq('rm_user_id', user.id);
  if (role === 'kam' && user) queryRecent = queryRecent.eq('kam_user_id', user.id);

  const [
    { data: recentCases },
  ] = await Promise.all([
    queryRecent,
  ]);

  // Fetch upcoming & delayed tranches for RM view
  let upcomingTranches: any[] = [];
  let delayedTranches: any[] = [];
  let rmMetrics: { totalExposure: number; averageMargin: number | null; countPDCR: number | null; amountPDCR: number | null; weightedDaysPDCR: number | null } | null = null;

  if (role === 'rm' && user) {
    rmMetrics = await computeRmPortfolioMetrics(supabase, user.id);

    // Fetch billing-active cases with their tranches
    const { data: activeCases } = await supabase
      .from('credit_cases')
      .select('id, case_number, billing_date, decided_bill_amount, actual_bill_amount, proposed_tranches, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
      .eq('rm_user_id', user.id)
      .in('status', ['Billing Active', 'Pending Write-Off Approval']);

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

  const statusBadge = (status: string) => {
    const map: Record<string, any> = {
      'Draft': 'secondary', 'In Review': 'warning', 'Awaiting Approval': 'warning',
      'Approved': 'success', 'Rejected': 'destructive', 'Withdrawn': 'secondary',
      'Billing Active': 'info', 'Pending Write-Off Approval': 'warning', 'Closed': 'success',
    };
    return <Badge variant={map[status] || 'secondary'}>{status}</Badge>;
  };

  const fmtPdcr = (n: number | null) => n != null ? `${n.toFixed(1)}%` : '—';

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          <BlurText text="Dashboard" />
        </h1>
        <p className="text-muted-foreground text-sm flex items-center gap-2">
          <Activity size={14} className="text-brand" aria-hidden="true" />
          <BlurText text="Credit Issuance System Overview" />
        </p>
      </div>

      <StaggeredFade className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-auto">
        
        {/* 1. Portfolio Overview (Large - 2x1) */}
        <SpotlightCard className="col-span-1 md:col-span-2 bg-card/70 backdrop-blur-md border-white/20 hover:scale-[1.01] transition-all">
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
                  <CountUp to={rmMetrics?.amountPDCR || 0} suffix="%" />
                </p>
              </div>
              <div>
                <p className="text-tiny font-bold uppercase tracking-widest text-muted-foreground mb-1">Avg Margin</p>
                <p className={cn("text-xl font-bold", (rmMetrics?.averageMargin || 0) >= 0 ? "text-success" : "text-destructive")}>
                  {(rmMetrics?.averageMargin || 0) >= 0 ? '+' : ''}
                  <CountUp to={Math.abs(rmMetrics?.averageMargin || 0)} decimals={2} suffix="%" />
                </p>
              </div>
            </div>
          </div>
        </SpotlightCard>

        {/* 2. Urgent Collections (1x1) */}
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

        {/* 3. Quick Shortcuts (1x1) */}
        <div className="grid grid-rows-2 gap-4">
          <Link href="/cases/new" className="group">
            <SpotlightCard className="h-full bg-brand text-brand-foreground hover:bg-brand/90 border-none transition-all flex items-center justify-center p-4">
              <div className="text-center space-y-1">
                <Plus size={24} className="mx-auto group-hover:rotate-90 transition-transform duration-300" aria-hidden="true" />
                <p className="text-xs font-bold uppercase tracking-widest">New Case</p>
              </div>
            </SpotlightCard>
          </Link>
          <Link href="/policy">
            <SpotlightCard className="h-full bg-card/70 backdrop-blur-md border-white/20 hover:bg-accent transition-all flex items-center justify-center p-4">
              <div className="text-center space-y-1">
                <ShieldCheck size={24} className="mx-auto text-brand" aria-hidden="true" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Policy</p>
              </div>
            </SpotlightCard>
          </Link>
        </div>

        {/* 4. Recent Activity (Tall - 2x2) */}
        <SpotlightCard className="col-span-1 md:col-span-2 row-span-2 bg-card/70 backdrop-blur-md border-white/20">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity size={16} className="text-brand" aria-hidden="true" />
                Recent Case Activity
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/cases" className="text-tiny">All Cases</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 px-0">
            {recentCases.map((c: any) => (
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

        {/* 5. Performance Metrics / Analytics (2x1) */}
        <SpotlightCard className="col-span-1 md:col-span-2 bg-card/70 backdrop-blur-md border-white/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <span className="text-tiny font-bold uppercase tracking-widest text-muted-foreground">Efficiency Funnel</span>
            <TrendingUp size={18} className="text-success" aria-hidden="true" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Approval Success Rate</span>
                <span className="text-foreground font-bold">78%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={78} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-success w-[78%] rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">PDCR (Amount)</span>
                <span className="text-foreground font-bold">{fmtPdcr(rmMetrics?.amountPDCR)}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={rmMetrics?.amountPDCR || 0} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-brand" style={{ width: `${rmMetrics?.amountPDCR || 0}%` }} />
              </div>
            </div>
          </div>
        </SpotlightCard>

        {/* 6. Quick Actions (2x1) */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
          {[
            { label: 'System Audit', href: '/audit', icon: ShieldCheck, color: 'text-info', bg: 'bg-info/10' },
            { label: 'Admin Panel', href: '/admin', icon: Users, iconColor: 'text-brand', bg: 'bg-brand/10' },
          ].map((action, i) => (
            <Link key={i} href={action.href}>
              <SpotlightCard className="h-full hover:bg-accent transition-all p-4 border-white/20 bg-card/70 backdrop-blur-md flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", action.bg)}>
                  <action.icon size={18} className={action.iconColor || action.color} aria-hidden="true" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">{action.label}</span>
              </SpotlightCard>
            </Link>
          ))}
        </div>

      </StaggeredFade>
    </div>
  );
}
