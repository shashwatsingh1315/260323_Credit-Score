import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, Briefcase, Building2, ChevronRight } from 'lucide-react';
import { getImpersonationRole } from '@/utils/auth-actions';

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const q = sp.q || '';
  const statusFilter = sp.status || '';

  const supabase = await createClient();
  const activeRole = await getImpersonationRole();

  let query = supabase
    .from('credit_cases')
    .select(`
      id, case_number, status, substatus, case_scenario, bill_amount, composite_credit_days, created_at,
      billing_date, decided_bill_amount, actual_bill_amount, proposed_tranches,
      customer:parties!credit_cases_customer_party_id_fkey(legal_name),
      contractor:parties!credit_cases_contractor_party_id_fkey(legal_name),
      rm:profiles!credit_cases_rm_user_id_fkey(full_name),
      review_cycles(approved_credit_days, is_active)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (statusFilter) query = query.eq('status', statusFilter);
  if (q) query = query.ilike('case_number', `%${q}%`);

  const { data: cases } = await query;

  const STATUS_VARIANT: Record<string, any> = {
    'Draft': 'secondary', 'In Review': 'warning', 'Awaiting Approval': 'warning',
    'Approved': 'success', 'Rejected': 'destructive', 'Withdrawn': 'secondary',
    'Billing Active': 'info', 'Pending Write-Off Approval': 'warning', 'Closed': 'success', 'Cancelled': 'destructive', 'Accepted': 'success',
  };

  const statuses = [
    '', 'Draft', 'In Review', 'Awaiting Approval', 'Approved', 'Rejected', 
    'Accepted', 'Billing Active', 'Pending Write-Off Approval', 'Closed', 'Cancelled', 'Withdrawn'
  ];
  const canCreateCase = activeRole === 'rm' || activeRole === 'founder_admin';

  const getTrancheStatus = (c: any) => {
    if (!['Billing Active', 'Pending Write-Off Approval'].includes(c.status)) return null;
    if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) return null;
    
    const now = new Date();
    const billingDate = new Date(c.billing_date);
    let remaining = c.actual_bill_amount ?? 0;
    
    let earliestDue: Date | null = null;
    let unpaidAmount = 0;
  
    for (const t of c.proposed_tranches as any[]) {
      const amt = t.type === 'percentage'
        ? Math.round((t.value / 100) * c.decided_bill_amount)
        : Math.round(t.value);
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      
      const fill = Math.min(remaining, amt);
      remaining -= fill;
      const unpaid = amt - fill;
      
      if (unpaid > 0) {
        earliestDue = due;
        unpaidAmount = unpaid;
        break;
      }
    }
  
    if (!earliestDue || unpaidAmount <= 0) return null;
    
    const daysOverdue = Math.floor((now.getTime() - earliestDue.getTime()) / (1000 * 3600 * 24));
    
    if (daysOverdue > 0) {
      return { type: 'delayed', text: `₹${unpaidAmount.toLocaleString('en-IN')} Overdue (${daysOverdue} d)` };
    } else {
      return { type: 'upcoming', text: `Upcoming: ₹${unpaidAmount.toLocaleString('en-IN')} on ${earliestDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credit Cases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{cases?.length || 0} cases</p>
        </div>
        {canCreateCase && (
          <Button asChild>
            <Link href="/cases/new"><PlusCircle size={16} /> New Case</Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <form className="flex gap-2 flex-1 min-w-0 max-w-xs">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search case number..."
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <Button type="submit" size="sm" variant="secondary">Search</Button>
        </form>
        <div className="flex gap-1 flex-wrap">
          {statuses.map(s => (
            <Link key={s} href={`/cases${s ? `?status=${s}` : ''}${q ? `${s ? '&' : '?'}q=${q}` : ''}`}>
              <Button size="sm" variant={statusFilter === s ? 'default' : 'secondary'} className="text-xs">
                {s || 'All'}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Cases Grid */}
      {!cases || cases.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Briefcase size={40} className="mx-auto text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">No cases found.</p>
            {canCreateCase && (
              <Button asChild><Link href="/cases/new">Create your first case</Link></Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {cases.map((c: any) => {
            const ts = getTrancheStatus(c);
            return (
            <Link key={c.id} href={`/cases/${c.id}`}>
              <Card className="hover:border-primary/50 transition-all hover:bg-accent/10 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{c.case_number}</span>
                        <Badge variant={STATUS_VARIANT[c.status] || 'secondary'} className="text-xs">{c.status}</Badge>
                        {c.substatus && <Badge variant="secondary" className="text-xs">{c.substatus}</Badge>}
                        {ts && (
                          <Badge variant={ts.type === 'delayed' ? 'destructive' : 'secondary'} className={ts.type === 'upcoming' ? 'bg-amber-400/20 text-amber-600 dark:text-amber-400 font-medium border-transparent text-tiny' : 'text-tiny'}>
                            {ts.text}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(c.customer as any)?.legal_name || (c.contractor as any)?.legal_name || '—'} ·{' '}
                        {c.case_scenario?.replace(/_/g, ' ')} ·{' '}
                        ₹{(c.bill_amount || 0).toLocaleString('en-IN')} ·{' '}
                        {['Approved', 'Accepted', 'Billing Active', 'Pending Write-Off Approval', 'Closed'].includes(c.status) 
                          ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{c.review_cycles?.find((r: any) => r.is_active)?.approved_credit_days ?? c.review_cycles?.[0]?.approved_credit_days ?? '—'} approved days</span>
                          : `${c.composite_credit_days || 0} requested days`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">{(c.rm as any)?.full_name || '—'}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
