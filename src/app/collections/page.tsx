import Link from 'next/link';
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
        <p className="text-muted-foreground mb-4">You do not have permission to view collections.</p>
        <Link href="/" className="text-sm text-primary hover:underline">← Back to dashboard</Link>
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
      rm_user_id, kam_user_id, case_attributes, contractor_party_id, customer_party_id,
      customer:parties!credit_cases_customer_party_id_fkey(legal_name),
      contractor:parties!credit_cases_contractor_party_id_fkey(legal_name),
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

  // Upcoming collections (doctrine §12.10): billing-active cases whose next
  // unpaid tranche falls due within 30 days — proactive, not only reactive.
  const upcomingCases = (cases || [])
    .filter(c => !overdueCaseIds.includes(c.id) && c.billing_date && c.decided_bill_amount && Array.isArray(c.proposed_tranches))
    .map(c => {
      const billingDate = new Date(c.billing_date);
      const billAmt = c.decided_bill_amount;
      let remaining = c.actual_bill_amount ?? 0;
      for (let i = 0; i < (c.proposed_tranches as TrancheLite[]).length; i++) {
        const t = (c.proposed_tranches as TrancheLite[])[i];
        const amt = t.type === 'percentage' ? Math.round((t.value / 100) * billAmt) : Math.round(t.value);
        const fill = Math.min(remaining, amt);
        remaining -= fill;
        const unpaid = amt - fill;
        if (unpaid > 0) {
          const due = new Date(billingDate);
          due.setDate(due.getDate() + (t.days_after_billing ?? 0));
          const daysUntil = Math.ceil((due.getTime() - now.getTime()) / 86400000);
          if (daysUntil < 0 || daysUntil > 30) return null;
          return { ...c, _dueDate: due.toISOString(), _amountDue: unpaid, _daysUntil: daysUntil, _trancheIndex: i };
        }
      }
      return null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a._daysUntil - b._daysUntil);

  // All other billed cases tied to the same contractor (or customer when no
  // contractor) — powers the per-contractor exposure roll-up in the client.
  const partyIds = Array.from(new Set(
    overdueCases.flatMap(c => [c.contractor_party_id, c.customer_party_id]).filter(Boolean)
  )) as string[];

  let relatedCases: any[] = [];
  if (partyIds.length > 0) {
    const list = partyIds.join(',');
    const { data } = await supabase
      .from('credit_cases')
      .select(`
        id, case_number, status, bill_amount, decided_bill_amount, actual_bill_amount,
        billing_date, proposed_tranches, composite_credit_days,
        contractor_party_id, customer_party_id,
        customer:parties!credit_cases_customer_party_id_fkey(legal_name)
      `)
      .or(`contractor_party_id.in.(${list}),customer_party_id.in.(${list})`)
      .not('billing_date', 'is', null);
    relatedCases = data || [];
  }

  // Repayments in the last 7 days across the user's overdue queue —
  // passed raw so the client can recompute "Recovered" under any filter.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: recentRepayments } = overdueCaseIds.length > 0
    ? await supabase.from('repayments')
        .select('amount, payment_date, case_id')
        .in('case_id', overdueCaseIds)
        .gte('payment_date', sevenDaysAgo)
    : { data: [] };

  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, full_name, roles:user_roles(role)');

  const rms = allUsers?.filter(u => u.roles?.some((r: any) => r.role === 'rm')) || [];

  const { data: hqLogs } = overdueCaseIds.length > 0 ? await supabase.from('hq_collection_logs')
    .select('*, logged_by_user:profiles!hq_collection_logs_logged_by_fkey(full_name)')
    .in('case_id', overdueCaseIds)
    .order('created_at', { ascending: true }) : { data: [] };

  return <CollectionsClient
    collections={overdueCases}
    upcomingCases={upcomingCases as any[]}
    escalations={escalations || []}
    rms={rms || []}
    hqLogs={hqLogs || []}
    relatedCases={relatedCases}
    repayments7d={recentRepayments || []}
    currentRole={role}
  />;
}
