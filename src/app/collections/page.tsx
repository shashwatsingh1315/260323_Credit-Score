import { createClient } from '@/utils/supabase/server';
import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';
import CollectionsClient from './CollectionsClient';
import { refreshPtpStatuses } from './actions';

export default async function CollectionsPage() {
  const role = await getImpersonationRole() || 'viewer';

  if (!['founder_admin', 'rm', 'kam', 'accounts'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view collections.</p>
      </div>
    );
  }

  const supabase = await createClient();
  await refreshPtpStatuses();
  const user = await getCurrentUser();

  let casesQuery = supabase
    .from('credit_cases')
    .select(`
      id, case_number, status, bill_amount, composite_credit_days, escalation_level,
      billing_date, decided_bill_amount, actual_bill_amount, proposed_tranches,
      rm_user_id, kam_user_id, case_attributes,
      customer:parties!credit_cases_customer_party_id_fkey(legal_name),
      rm:profiles!credit_cases_rm_user_id_fkey(full_name),
      escalations (id, status, ptp_date, last_hq_update_at, level, tranche_index)
    `)
    .in('status', ['Billing Active', 'Pending Write-Off Approval']);

  if (role === 'rm' && user) {
    casesQuery = casesQuery.eq('rm_user_id', user.id);
  } else if (role === 'kam' && user) {
    casesQuery = casesQuery.or(`kam_user_id.eq.${user.id},kam_user_id.is.null`);
  }
  // accounts and founder_admin see the full queue.

  const { data: cases } = await casesQuery;

  const { data: escalations } = await supabase
    .from('escalation_thresholds')
    .select('*')
    .order('escalation_level', { ascending: true });

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  type TrancheLite = { type?: string; value: number; days_after_billing?: number };

  // Returns the maximum days-overdue across unpaid tranches for a case (0 if not overdue).
  const maxOverdueDays = (c: any): number => {
    if (!c.billing_date) return 0;
    const billingDate = new Date(c.billing_date);
    const tranches = (c.proposed_tranches as TrancheLite[] | null) || [];
    if (tranches.length > 0 && c.decided_bill_amount) {
      const billAmt = c.decided_bill_amount;
      let remaining = c.actual_bill_amount ?? 0;
      let worst = 0;
      for (const t of tranches) {
        const amt = t.type === 'percentage'
          ? Math.round((t.value / 100) * billAmt)
          : Math.round(t.value);
        const fill = Math.min(remaining, amt);
        remaining -= fill;
        const unpaid = amt - fill;
        if (unpaid > 0) {
          const due = new Date(billingDate);
          due.setDate(due.getDate() + (t.days_after_billing ?? 0));
          const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
          if (days > worst) worst = days;
        }
      }
      return worst;
    }
    const passed = Math.floor((now.getTime() - new Date(c.billing_date).getTime()) / 86400000);
    return Math.max(0, passed - (c.composite_credit_days || 0));
  };

  const overdueCases = (cases || [])
    .map(c => ({ ...c, _overdueDays: maxOverdueDays(c) }))
    .filter(c => c._overdueDays > 0);

  const overdueCaseIds = overdueCases.map(c => c.id);

  const outstandingOf = (c: any) =>
    Math.max(0, (c.decided_bill_amount || c.bill_amount || 0) - (c.actual_bill_amount ?? 0));

  // Recovered in the last 7 days across the user's overdue queue
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: recentRepayments } = overdueCaseIds.length > 0
    ? await supabase.from('repayments')
        .select('amount, payment_date, case_id')
        .in('case_id', overdueCaseIds)
        .gte('payment_date', sevenDaysAgo)
    : { data: [] };
  const recovered7d = (recentRepayments || []).reduce((s, r: any) => s + (r.amount || 0), 0);

  // Aging buckets
  const buckets = { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 } as Record<string, number>;
  const bucketAmts = { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 } as Record<string, number>;
  for (const c of overdueCases) {
    const d = c._overdueDays;
    const amt = outstandingOf(c);
    const key = d <= 30 ? '1-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+';
    buckets[key] += 1;
    bucketAmts[key] += amt;
  }

  // PTPs due today (snoozed escalation with ptp_date == today)
  const ptpDueTodayCount = overdueCases.filter(c =>
    ((c.escalations as any[]) || []).some(e => e.status === 'snoozed' && e.ptp_date === todayIso)
  ).length;

  // High risk (90+ DPD) total
  const highRiskAmt = bucketAmts['90+'];
  const highRiskCount = buckets['90+'];

  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, full_name, roles:user_roles(role)');

  const rms = allUsers?.filter(u => u.roles?.some((r: any) => r.role === 'rm')) || [];

  const { data: hqLogs } = overdueCaseIds.length > 0 ? await supabase.from('hq_collection_logs')
    .select('*, logged_by_user:profiles!hq_collection_logs_logged_by_fkey(full_name)')
    .in('case_id', overdueCaseIds)
    .order('created_at', { ascending: true }) : { data: [] };

  // Untouched 14d+ count (no hq log in last 14 days)
  const fourteenDaysAgo = now.getTime() - 14 * 86400000;
  const lastHqByCase = new Map<string, number>();
  for (const log of (hqLogs || [])) {
    const t = new Date(log.created_at).getTime();
    const prev = lastHqByCase.get(log.case_id);
    if (prev === undefined || t > prev) lastHqByCase.set(log.case_id, t);
  }
  const untouched14dCount = overdueCases.filter(c => {
    const last = lastHqByCase.get(c.id);
    return last === undefined || last < fourteenDaysAgo;
  }).length;

  const stats = {
    totalOverdue: overdueCases.reduce((sum, c) => sum + outstandingOf(c), 0),
    countOverdue: overdueCases.length,
    highRiskAmt,
    highRiskCount,
    ptpDueTodayCount,
    recovered7d,
    recoveredCount7d: (recentRepayments || []).length,
    buckets,
    bucketAmts,
    untouched14dCount,
  };

  return <CollectionsClient
    collections={overdueCases}
    stats={stats}
    escalations={escalations || []}
    rms={rms || []}
    hqLogs={hqLogs || []}
    currentRole={role}
  />;
}
