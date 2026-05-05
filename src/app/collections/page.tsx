import { createClient } from '@/utils/supabase/server';
import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';
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
  const user = await getCurrentUser();

  let casesQuery = supabase
    .from('credit_cases')
    .select(`
      id, case_number, status, bill_amount, composite_credit_days, escalation_level,
      billing_date, decided_bill_amount, actual_bill_amount, proposed_tranches,
      rm_user_id, kam_user_id, case_attributes,
      customer:parties!credit_cases_customer_party_id_fkey(legal_name),
      rm:profiles!credit_cases_rm_user_id_fkey(full_name),
      escalations (id, status, ptp_date, last_hq_update_at)
    `)
    .in('status', ['Billing Active', 'Pending Write-Off Approval']);

  if (role === 'rm' && user) {
    casesQuery = casesQuery.eq('rm_user_id', user.id);
  } else if (role === 'kam' && user) {
    casesQuery = casesQuery.eq('kam_user_id', user.id);
  }

  const { data: cases } = await casesQuery;

  // Fetch escalation config from admin settings
  const { data: escalations } = await supabase
    .from('escalation_thresholds')
    .select('*')
    .order('escalation_level', { ascending: true });

  const now = new Date();

  const overdueCases = (cases || []).filter(c => {
    if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) return false;
    const billingDate = new Date(c.billing_date);
    const billAmt = c.decided_bill_amount;
    let remaining = c.actual_bill_amount ?? 0;
    for (const t of c.proposed_tranches as any[]) {
      const amt = t.type === 'percentage'
        ? Math.round((t.value / 100) * billAmt)
        : Math.round(t.value);
      const fill = Math.min(remaining, amt);
      remaining -= fill;
      if (fill < amt) {
        // This tranche is not fully paid
        const due = new Date(billingDate);
        due.setDate(due.getDate() + (t.days_after_billing ?? 0));
        if (due < now) return true; // past due date with unpaid amount
      }
    }
    return false;
  });

  const stats = {
    totalOverdue: overdueCases.reduce((sum, c) => {
      const outstanding = Math.max(0, (c.decided_bill_amount || c.bill_amount || 0) - (c.actual_bill_amount ?? 0));
      return sum + outstanding;
    }, 0),
    countOverdue: overdueCases.length,
    totalEscalated: overdueCases
      .filter(c => (c.escalation_level ?? 0) > 0)
      .reduce((sum, c) => {
        const outstanding = Math.max(0, (c.decided_bill_amount || c.bill_amount || 0) - (c.actual_bill_amount ?? 0));
        return sum + outstanding;
      }, 0),
    countEscalated: overdueCases.filter(c => (c.escalation_level ?? 0) > 0).length,
  };

  // Fetch available RMs
  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, full_name, roles:user_roles(role)');
  
  const rms = allUsers?.filter(u => u.roles?.some((r: any) => r.role === 'rm')) || [];
  
  // Fetch HQ logs for overdue cases
  const overdueCaseIds = overdueCases.map(c => c.id);
  const { data: hqLogs } = overdueCaseIds.length > 0 ? await supabase.from('hq_collection_logs')
    .select('*, logged_by_user:profiles!hq_collection_logs_logged_by_fkey(full_name)')
    .in('case_id', overdueCaseIds)
    .order('created_at', { ascending: true }) : { data: [] };

  return <CollectionsClient collections={overdueCases} stats={stats} escalations={escalations || []} rms={rms || []} hqLogs={hqLogs || []} />;
}
lectionsClient collections={overdueCases} stats={stats} escalations={escalations || []} rms={rms || []} hqLogs={hqLogs || []} />;
}
