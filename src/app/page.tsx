import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Briefcase, Clock, CheckCircle, AlertCircle, TrendingUp, Users, ShieldCheck, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalCases },
    { count: inReview },
    { count: awaitingApproval },
    { count: approved },
    { count: drafts },
    { count: totalParties },
    { data: recentCases },
  ] = await Promise.all([
    supabase.from('credit_cases').select('*', { count: 'exact', head: true }),
    supabase.from('credit_cases').select('*', { count: 'exact', head: true }).eq('status', 'In Review'),
    supabase.from('credit_cases').select('*', { count: 'exact', head: true }).eq('status', 'Awaiting Approval'),
    supabase.from('credit_cases').select('*', { count: 'exact', head: true }).eq('status', 'Approved'),
    supabase.from('credit_cases').select('*', { count: 'exact', head: true }).eq('status', 'Draft'),
    supabase.from('parties').select('*', { count: 'exact', head: true }),
    supabase.from('credit_cases')
      .select('id, case_number, status, case_scenario, bill_amount, created_at, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const stats = [
    { label: 'Total Cases', value: totalCases || 0, icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'In Review', value: inReview || 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Awaiting Approval', value: awaitingApproval || 0, icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'Approved', value: approved || 0, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Drafts', value: drafts || 0, icon: TrendingUp, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Parties', value: totalParties || 0, icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, any> = {
      'Draft': 'secondary', 'In Review': 'warning', 'Awaiting Approval': 'warning',
      'Approved': 'success', 'Rejected': 'destructive', 'Withdrawn': 'secondary',
    };
    return <Badge variant={map[status] || 'secondary'}>{status}</Badge>;
  };

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
