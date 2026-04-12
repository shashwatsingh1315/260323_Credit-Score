"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, ShieldAlert, ArrowUpRight, Search, FileText } from 'lucide-react';
import { handleEscalateCase } from './actions';

interface Case {
  id: string;
  case_number: string;
  status: string;
  bill_amount: number;
  decided_bill_amount?: number | null;
  actual_bill_amount?: number | null;
  composite_credit_days?: number;
  escalation_level?: number;
  billing_date?: string | null;
  customer?: { legal_name: string }[] | { legal_name: string } | null;
}

function getCustomerName(c: Case): string {
  if (!c.customer) return '—';
  if (Array.isArray(c.customer)) return c.customer[0]?.legal_name || '—';
  return c.customer.legal_name || '—';
}

export default function CollectionsClient({ collections, stats, escalations }: {
  collections: Case[];
  stats: { totalOverdue: number; countOverdue: number; totalEscalated: number; countEscalated: number };
  escalations: any[];
}) {
  const [search, setSearch] = useState('');

  const filtered = collections.filter(c =>
    getCustomerName(c).toLowerCase().includes(search.toLowerCase()) ||
    c.case_number?.toLowerCase().includes(search.toLowerCase()) ||
    c.id.includes(search)
  );

  const getOverdueDays = (c: Case): number => {
    if (!c.billing_date) return 0;
    const passedDays = Math.floor((new Date().getTime() - new Date(c.billing_date).getTime()) / 86400000);
    return Math.max(0, passedDays - (c.composite_credit_days || 0));
  };

  const getOutstanding = (c: Case): number => {
    const billed = c.decided_bill_amount || c.bill_amount || 0;
    const collected = c.actual_bill_amount || 0;
    return Math.max(0, billed - collected);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Collections & Escalations</h1>
          <p className="text-sm text-muted-foreground">Monitor overdue cases and manage recovery escalations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={18} className="text-amber-500" />
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Total Overdue</p>
            </div>
            <p className="text-3xl font-bold">₹{(stats.totalOverdue || 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.countOverdue} case{stats.countOverdue !== 1 ? 's' : ''} currently past SLA</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={18} className="text-destructive" />
              <p className="text-sm font-semibold text-destructive uppercase tracking-wider">High Risk Escalations</p>
            </div>
            <p className="text-3xl font-bold">₹{(stats.totalEscalated || 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.countEscalated} case{stats.countEscalated !== 1 ? 's' : ''} requiring immediate attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input 
            placeholder="Search customer or case number..." 
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered.length === 0 ? (
          <Card className="py-12 border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText size={24} className="text-muted-foreground" />
              </div>
              <p className="text-base font-semibold">No Collections Data</p>
              <p className="text-sm text-muted-foreground">All clear or no matches found.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((c) => {
            const overdueDays = getOverdueDays(c);
            const outstanding = getOutstanding(c);
            const isEscalated = (c.escalation_level ?? 0) > 0;
            const nextLevel = (c.escalation_level ?? 0) + 1;
            const targetRole = escalations.find(e => e.escalation_level === nextLevel)?.escalate_to_role || 'founder_admin';

            return (
              <Card key={c.id} className={isEscalated ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}>
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <h3 className="font-semibold text-base">{getCustomerName(c)}</h3>
                       <Badge variant={isEscalated ? 'destructive' : 'warning'} className="text-xs uppercase py-0 tracking-widest">
                         {isEscalated ? `Escalation L${c.escalation_level}` : 'Overdue'}
                       </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        <Link href={`/cases/${c.id}`} className="hover:underline font-mono text-xs">
                          {c.case_number || c.id.split('-')[0]}
                        </Link>
                      </span>
                      <span>•</span>
                      <span className="font-medium text-foreground">
                        ₹{outstanding.toLocaleString('en-IN')} outstanding
                      </span>
                      <span>•</span>
                      <span className={isEscalated ? "text-destructive font-semibold" : "text-amber-500 font-semibold"}>
                        {overdueDays} Day{overdueDays !== 1 ? 's' : ''} Overdue
                      </span>
                    </div>
                    {c.billing_date && (
                      <p className="text-xs text-muted-foreground">
                        RM Handover: {new Date(c.billing_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' · '}Credit Terms: {c.composite_credit_days || 0} days
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <form action={handleEscalateCase}>
                      <input type="hidden" name="caseId" value={c.id} />
                      <input type="hidden" name="targetRole" value={targetRole} />
                      <Button
                        type="submit"
                        variant={isEscalated ? "destructive" : "outline"}
                        size="sm"
                        className={!isEscalated ? "border-amber-500 text-amber-600 hover:bg-amber-50" : ""}
                      >
                        <ArrowUpRight size={14} className="mr-1.5" /> 
                        Escalate to {targetRole.replace(/_/g, ' ')}
                      </Button>
                    </form>
                    <Link href={`/cases/${c.id}`} passHref>
                      <Button variant="secondary" size="sm">View Case</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
