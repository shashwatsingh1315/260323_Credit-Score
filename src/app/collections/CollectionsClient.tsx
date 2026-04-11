"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ShieldAlert, ArrowUpRight, Search, FileText } from 'lucide-react';
import { handleEscalateCase } from './actions';

interface Case {
  id: string;
  status: string;
  bill_amount: number;
  composite_credit_days?: number;
  escalation_level?: number;
  customer?: { legal_name: string };
  ledger?: any;
}

export default function CollectionsClient({ collections, stats, escalations }: { collections: Case[], stats: any, escalations: any[] }) {
  const [search, setSearch] = useState('');

  const filtered = collections.filter(c =>
    c.customer?.legal_name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Collections & Escalations</h1>
          <p className="text-sm text-muted-foreground">Monitor overdue cases and manage recovery escalations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={18} className="text-warning text-amber-500" />
              <p className="text-sm font-semibold text-warning-foreground uppercase tracking-wider">Total Overdue</p>
            </div>
            <p className="text-3xl font-bold">₹{(stats.totalOverdue || 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.countOverdue} cases currently past SLA</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={18} className="text-destructive text-red-500" />
              <p className="text-sm font-semibold text-destructive uppercase tracking-wider">High Risk Escalations</p>
            </div>
            <p className="text-3xl font-bold">₹{(stats.totalEscalated || 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.countEscalated} cases requiring immediate attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input 
            placeholder="Search customer or case ID..." 
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
            const overdueDays = Math.floor((new Date().getTime() - new Date(c.ledger?.billingDate).getTime()) / 86400000) - (c.composite_credit_days || 0);
            const isEscalated = (c.escalation_level ?? 0) > 0;
            const targetRole = escalations.find(e => e.escalation_level === (c.escalation_level ?? 0) + 1)?.escalate_to_role || 'founder_admin';

            return (
              <Card key={c.id} className={isEscalated ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}>
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <h3 className="font-semibold text-base">{c.customer?.legal_name}</h3>
                       <Badge variant={isEscalated ? 'destructive' : 'warning'} className="text-xs uppercase py-0 tracking-widest">
                         {isEscalated ? `Escalation L${c.escalation_level}` : 'Overdue'}
                       </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Case ID: <Link href={`/cases/${c.id}`} className="hover:underline">{c.id.split('-')[0]}</Link></span>
                      <span>•</span>
                      <span className="font-medium text-foreground">₹{(c.bill_amount || 0).toLocaleString('en-IN')}</span>
                      <span>•</span>
                      <span className={isEscalated ? "text-destructive font-semibold" : "text-amber-500 font-semibold"}>
                        {overdueDays} Days Overdue
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <form action={handleEscalateCase}>
                      <input type="hidden" name="caseId" value={c.id} />
                      <input type="hidden" name="targetRole" value={targetRole} />
                      <Button type="submit" variant={isEscalated ? "destructive" : "outline"} size="sm" className={!isEscalated ? "border-amber-500 text-amber-600 hover:bg-amber-50" : ""}>
                        <ArrowUpRight size={14} className="mr-1.5" /> 
                        Escalate to {targetRole.replace('_', ' ')}
                      </Button>
                    </form>
                    <Link href={`/cases/${c.id}`} passHref>
                      <Button variant="secondary" size="sm">Workspace</Button>
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
