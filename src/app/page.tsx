import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Briefcase, Clock, CheckCircle, AlertCircle, TrendingUp, Users, ShieldCheck, ArrowRight, Wallet, TrendingDown, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';

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

  const weightedDaysPDCR = totalWeightedActualDays > 0
    ? Math.min(100, (totalWeightedProposedDays / totalWeightedActualDays) * 100)
    : null;

  return { totalExposure, averageMargin, countPDCR, amountPDCR, weightedDaysPDCR };
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const role = await getImpersonationRole();

  let queryCases = supabase.from('credit_cases').select('*', { count: 'exact', head: true });
  let queryInReview = supabase.from('credit_cases').select('*', { count: 'exact', head: true }).eq('status', 'In Review');
  let queryAwaiting = supabase.from('credit_cases').select('*', { count: 'exact', head: true }).in('status', ['Awaiting Approval', 'Appealed']);
  let queryApproved = supabase.from('credit_cases').select('*', { count: 'exact', head: true }).eq('status', 'Approved');
  let queryDrafts = supabase.from('credit_cases').select('*', { count: 'exact', head: true }).eq('status', 'Draft');
  let queryBillingActive = supabase.from('credit_cases').select('*', { count: 'exact', head: true }).eq('status', 'Billing Active');

  if (role === 'rm' && user) {
    queryCases = queryCases.eq('rm_user_id', user.id);
    queryInReview = queryInReview.eq('rm_user_id', user.id);
    queryAwaiting = queryAwaiting.eq('rm_user_id', user.id);
    queryApproved = queryApproved.eq('rm_user_id', user.id);
    queryDrafts = queryDrafts.eq('rm_user_id', user.id);
    queryBillingActive = queryBillingActive.eq('rm_user_id', user.id);
  } else if (role === 'kam' && user) {
    queryCases = queryCases.eq('kam_user_id', user.id);
    queryInReview = queryInReview.eq('kam_user_id', user.id);
    queryAwaiting = queryAwaiting.eq('kam_user_id', user.id);
    queryApproved = queryApproved.eq('kam_user_id', user.id);
    queryDrafts = queryDrafts.eq('kam_user_id', user.id);
    queryBillingActive = queryBillingActive.eq('kam_user_id', user.id);
  }

  let queryRecent = supabase.from('credit_cases')
    .select('id, case_number, status, case_scenario, bill_amount, created_at, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (role === 'rm' && user) queryRecent = queryRecent.eq('rm_user_id', user.id);
  if (role === 'kam' && user) queryRecent = queryRecent.eq('kam_user_id', user.id);

  const [
    { count: totalCases },
    { count: inReview },
    { count: awaitingApproval },
    { count: approved },
    { count: drafts },
    { count: totalParties },
    { count: billingActive },
    { data: recentCases },
  ] = await Promise.all([
    queryCases,
    queryInReview,
    queryAwaiting,
    queryApproved,
    queryDrafts,
    supabase.from('parties').select('*', { count: 'exact', head: true }),
    queryBillingActive,
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

  const stats = [
    { label: 'Total Cases', value: totalCases || 0, icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'In Review', value: inReview || 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Awaiting Approval', value: awaitingApproval || 0, icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'Approved', value: approved || 0, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Billing Active', value: billingActive || 0, icon: Wallet, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
    { label: 'Parties', value: totalParties || 0, icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, any> = {
      'Draft': 'secondary', 'In Review': 'warning', 'Awaiting Approval': 'warning',
      'Approved': 'success', 'Rejected': 'destructive', 'Withdrawn': 'secondary',
      'Billing Active': 'info', 'Pending Write-Off Approval': 'warning', 'Closed': 'success',
    };
    return <Badge variant={map[status] || 'secondary'}>{status}</Badge>;
  };

  const fmtRupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const fmtPdcr = (n: number | null) => n != null ? `${n.toFixed(1)}%` : '—';
  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Credit Issuance System Overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <Icon size={18} className={s.color} />
                  </div>
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* RM-specific portfolio metrics */}
      {role === 'rm' && rmMetrics && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">My Portfolio Metrics</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-indigo-400/30 bg-indigo-500/5">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Exposure</p>
                <p className="text-2xl font-bold text-indigo-400">{fmtRupee(rmMetrics.totalExposure)}</p>
              </CardContent>
            </Card>
            <Card className={rmMetrics.averageMargin != null && rmMetrics.averageMargin >= 0 ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'}>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Margin</p>
                <p className={`text-2xl font-bold ${rmMetrics.averageMargin != null && rmMetrics.averageMargin >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                  {rmMetrics.averageMargin != null ? `${rmMetrics.averageMargin >= 0 ? '+' : ''}${rmMetrics.averageMargin.toFixed(2)}%` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Promised Day Collection Rate (PDCR)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Count</p>
                    <p className="text-xl font-bold text-primary">{fmtPdcr(rmMetrics.countPDCR)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Amount</p>
                    <p className="text-xl font-bold text-primary">{fmtPdcr(rmMetrics.amountPDCR)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Weighted Days</p>
                    <p className="text-xl font-bold text-primary">{fmtPdcr(rmMetrics.weightedDaysPDCR)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming vs Delayed Collections */}
          <div className="grid grid-cols-2 gap-4">
            {/* Upcoming */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock size={15} className="text-amber-400" />
                  Upcoming Collections
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {upcomingTranches.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-2">No upcoming payments.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {upcomingTranches.slice(0, 5).map((t, i) => (
                      <Link key={i} href={`/cases/${t.caseId}`} className="flex items-center justify-between py-2.5 hover:bg-muted/40 -mx-4 px-4 rounded-lg transition-colors">
                        <div>
                          <p className="text-sm font-medium">{t.caseNumber}</p>
                          <p className="text-xs text-muted-foreground">{t.customerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{fmtRupee(t.unpaid)}</p>
                          <p className="text-xs text-amber-400">Due {fmtDate(t.dueDate)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delayed */}
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle size={15} className="text-destructive" />
                  Delayed Collections
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {delayedTranches.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-2">No delayed payments. 🎉</p>
                ) : (
                  <div className="divide-y divide-border">
                    {delayedTranches.slice(0, 5).map((t, i) => (
                      <Link key={i} href={`/cases/${t.caseId}`} className="flex items-center justify-between py-2.5 hover:bg-muted/40 -mx-4 px-4 rounded-lg transition-colors">
                        <div>
                          <p className="text-sm font-medium">{t.caseNumber}</p>
                          <p className="text-xs text-muted-foreground">{t.customerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-destructive">{fmtRupee(t.unpaid)}</p>
                          <p className="text-xs text-destructive">Overdue {t.daysOverdue}d</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Recent Cases */}
        <Card className="col-span-2">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Cases</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/cases">View all <ArrowRight size={14} /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {(!recentCases || recentCases.length === 0) ? (
              <p className="text-muted-foreground text-sm py-4">No cases yet. <Link href="/cases/new" className="text-primary hover:underline">Create one →</Link></p>
            ) : (
              <div className="divide-y divide-border">
                {recentCases.map((c: any) => (
                  <Link href={`/cases/${c.id}`} key={c.id} className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-4 px-4 rounded-lg transition-colors">
                    <div>
                      <p className="text-sm font-medium">{c.case_number}</p>
                      <p className="text-xs text-muted-foreground">{(c.customer as any)?.legal_name || '—'} · {new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    {statusBadge(c.status)}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {[
              { href: '/cases/new', label: 'New Credit Case', icon: Briefcase },
              { href: '/cases', label: 'View All Cases', icon: Clock },
              { href: '/policy', label: 'Policy Engine', icon: ShieldCheck },
              { href: '/admin', label: 'Admin Panel', icon: Users },
              { href: '/settings', label: 'System Settings', icon: Activity },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted border border-transparent hover:border-border text-sm font-medium text-foreground transition-all group">
                  <Icon size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  {a.label}
                  <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
