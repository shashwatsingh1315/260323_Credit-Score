import { createClient } from '@/utils/supabase/server';
import { getImpersonationRole } from '@/utils/auth-actions';
import CollectionsClient from './CollectionsClient';

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

  const { data: cases } = await supabase
    .from('credit_cases')
    .select(`
      id, status, bill_amount, composite_credit_days, escalation_level,
      customer:customer_id(legal_name),
      ledger:case_ledgers(billing_date, actual_amount, is_locked)
    `)
    .in('status', ['Billing Active', 'Pending Write-Off Approval']);

  const { data: escalations } = await supabase
    .from('escalations')
    .select('*')
    .order('escalation_level', { ascending: true });

  const overdueCases = (cases || []).filter(c => {
    if (!c.ledger?.[0]?.billing_date) return false;
    const l = c.ledger[0];
    if (l.is_locked) return false;
    const passedDays = Math.floor((new Date().getTime() - new Date(l.billing_date).getTime()) / 86400000);
    return passedDays > (c.composite_credit_days || 0);
  }).map(c => ({
    ...c,
    ledger: c.ledger?.[0]
  }));

  const stats = {
    totalOverdue: overdueCases.reduce((sum, c) => sum + (c.bill_amount || 0), 0),
    countOverdue: overdueCases.length,
    totalEscalated: overdueCases.filter(c => (c.escalation_level ?? 0) > 0).reduce((sum, c) => sum + (c.bill_amount || 0), 0),
    countEscalated: overdueCases.filter(c => (c.escalation_level ?? 0) > 0).length,
  };

  return <CollectionsClient collections={overdueCases} stats={stats} escalations={escalations || []} />;
}
