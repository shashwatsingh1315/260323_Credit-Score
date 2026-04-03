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
    <div className="space-y-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Credit Cases</h1>
          <p className="text-sm text-muted-foreground tracking-wide mt-1">{cases?.length || 0} cases matching criteria</p>
        </div>
        {canCreateCase && (
          <Button asChild className="h-12 px-6 rounded-xl font-bold shadow-md transition-all duration-300 ease-out hover:shadow-lg active:scale-[0.98]">
            <Link href="/cases/new"><PlusCircle size={18} className="mr-2" /> New Case</Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <form className="flex-1 min-w-0 max-w-sm flex items-center relative">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search case number..."
            className="w-full h-12 pl-4 pr-24 rounded-xl bg-muted/40 border border-border/50 focus:bg-background focus:ring-1 focus:ring-primary transition-all duration-300 outline-none text-sm font-medium"
          />
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <Button type="submit" size="sm" variant="secondary" className="absolute right-1.5 h-9 px-4 rounded-lg font-semibold bg-background border border-border/50 shadow-sm hover:bg-muted transition-colors">Search</Button>
        </form>
        <div className="flex gap-2 flex-wrap items-center">
          {statuses.map(s => (
            <Link key={s} href={`/cases${s ? `?status=${s}` : ''}${q ? `${s ? '&' : '?'}q=${q}` : ''}`}>
              <Button size="sm" variant={statusFilter === s ? 'default' : 'secondary'} className={`h-9 px-4 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ease-out ${statusFilter === s ? 'shadow-sm' : 'bg-transparent border border-border/60 hover:bg-muted/50'}`}>
                {s || 'All'}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Cases Grid */}
      {!cases || cases.length === 0 ? (
        <Card className="shadow-md rounded-2xl border-border/60">
          <CardContent className="py-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center">
              <Briefcase size={28} className="text-muted-foreground opacity-50" />
            </div>
            <p className="text-muted-foreground font-medium text-lg">No cases found.</p>
            {canCreateCase && (
              <Button asChild variant="outline" className="h-10 rounded-xl font-semibold"><Link href="/cases/new">Create your first case</Link></Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {cases.map((c: any) => {
            const ts = getTrancheStatus(c);
            return (
            <Link key={c.id} href={`/cases/${c.id}`} className="group block outline-none">
              <Card className="rounded-2xl border-border/50 shadow-sm transition-all duration-300 ease-out hover:shadow-md hover:border-primary/30 active:scale-[0.99] overflow-hidden">
                <CardContent className="p-6 relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/0 group-hover:bg-primary transition-colors duration-300" />
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors duration-300">
                      <Building2 size={20} className="text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">{c.case_number}</span>
                        <Badge variant={STATUS_VARIANT[c.status] || 'secondary'} className="text-xs px-2.5 py-0.5 rounded-md font-bold tracking-wide uppercase">{c.status}</Badge>
                        {c.substatus && <Badge variant="secondary" className="text-xs px-2 rounded-md font-semibold text-muted-foreground bg-muted border-transparent">{c.substatus}</Badge>}
                        {ts && (
                          <Badge variant={ts.type === 'delayed' ? 'destructive' : 'secondary'} className={`text-[10px] px-2 rounded-md font-bold uppercase tracking-wider ${ts.type === 'upcoming' ? 'bg-warning/20 text-warning border-transparent' : ''}`}>
                            {ts.text}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">
                        <span className="text-foreground">{(c.customer as any)?.legal_name || (c.contractor as any)?.legal_name || '—'}</span> <span className="opacity-50 mx-1.5">·</span>{' '}
                        {c.case_scenario?.replace(/_/g, ' ')} <span className="opacity-50 mx-1.5">·</span>{' '}
                        <span className="font-semibold text-foreground">₹{(c.bill_amount || 0).toLocaleString('en-IN')}</span> <span className="opacity-50 mx-1.5">·</span>{' '}
                        {['Approved', 'Accepted', 'Billing Active', 'Pending Write-Off Approval', 'Closed'].includes(c.status) 
                          ? <span className="text-success font-semibold">{c.review_cycles?.find((r: any) => r.is_active)?.approved_credit_days ?? c.review_cycles?.[0]?.approved_credit_days ?? '—'} approved days</span>
                          : `${c.composite_credit_days || 0} requested days`}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{new Date(c.created_at).toLocaleDateString()}</p>
                      <p className="text-xs font-medium text-foreground">{(c.rm as any)?.full_name || '—'}</p>
                    </div>
                    <div className="shrink-0 w-8 flex justify-end">
                      <ChevronRight size={20} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 ease-out" />
                    </div>
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
