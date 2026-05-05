import { createClient } from '@/utils/supabase/server';
import { getImpersonationRole } from '@/utils/auth-actions';
import CollectionsClient from './CollectionsClient';
import { refreshPtpStatuses } from './actions';

export default async function CollectionsPage() {
  const role = await getImpersonationRole() || 'viewer';
  
  if (!['founder_admin', 'rm', 'kam'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view collections.</p>
      </div>
    );
  }

  const supabase = await createClient();
  await refreshPtpStatuses();

  // Use billing_date directly from credit_cases (C5/H4 fix: no longer relies on case_ledgers join)
  const { data: cases } = await supabase
    .from('credit_cases')
    .select(`
      id, case_number, status, bill_amount, composite_credit_days, escalation_level,
      billing_date, decided_bill_amount, actual_bill_amount,
      customer:parties!credit_cases_customer_party_id_fkey(legal_name),
      escalations (id, status, ptp_date, last_hq_update_at)
    `)
    .in('status', ['Billing Active', 'Pending Write-Off Approval']);

  // Fetch escalation config from admin settings
  const { data: escalations } = await supabase
    .from('escalation_thresholds')
    .select('*')
    .order('escalation_level', { ascending: true });

  const now = new Date();

  const overdueCases = (cases || []).filter(c => {
    if (!c.billing_date) return false;
    const passedDays = Math.floor((now.getTime() - new Date(c.billing_date).getTime()) / 86400000);
    return passedDays > (c.composite_credit_days || 0);
  });

  const stats = {
    totalOverdue: overdueCases.reduce((sum, c) => sum + (c.decided_bill_amount || c.bill_amount || 0), 0),
    countOverdue: overdueCases.length,
    totalEscalated: overdueCases.filter(c => (c.escalation_level ?? 0) > 0).reduce((sum, c) => sum + (c.decided_bill_amount || c.bill_amount || 0), 0),
    countEscalated: overdueCases.filter(c => (c.escalation_level ?? 0) > 0).length,
  };

  return <CollectionsClient collections={overdueCases} stats={stats} escalations={escalations || []} />;
}
