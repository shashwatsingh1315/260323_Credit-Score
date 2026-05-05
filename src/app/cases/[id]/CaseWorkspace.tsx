"use client";
import { useState, useOptimistic, Suspense, use } from 'react';
import Link from 'next/link';
import {
  ChevronRight, Layers, History, Shield, MessageSquare,
  BarChart3, Award, Printer, Scale, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { handleWithdraw, handleCreateApprovalRound, handleChangePersona } from './actions';
import dynamic from 'next/dynamic';

const LedgerTab = dynamic(() => import('./LedgerTab'));
const OverviewTab = dynamic(() => import('./OverviewTab'));
const StagesTab = dynamic(() => import('./StagesTab'));
const ApprovalsTab = dynamic(() => import('./ApprovalsTab'));
const CommentsTab = dynamic(() => import('./CommentsTab'));
const AuditTab = dynamic(() => import('./AuditTab'));

const STATUS_VARIANT: Record<string, any> = {
  'Draft': 'secondary', 'In Review': 'warning', 'Awaiting Approval': 'warning',
  'Approved': 'success', 'Rejected': 'destructive', 'Withdrawn': 'secondary',
  'Completed': 'secondary', 'In Progress': 'info', 'Pending': 'outline',
  'Billing Active': 'info', 'Pending Write-Off Approval': 'warning', 'Closed': 'success', 'Cancelled': 'destructive', 'Accepted': 'success',
  'Appealed': 'warning'
};

// We create a wrapper component to unwrap the tasksPromise and set up optimistic state
function StagesTabWrapper({ coreData, promises, activeRole, liveScore }: any) {
  const { tasks, stageSummaries, users, rcaReasons, delayReasons } = use(promises.tasksPromise as Promise<any>);
  
  const [optimisticTasks, addOptimisticTask] = useOptimistic(
    tasks,
    (state, updatedTask: any) =>
      state.map((t: any) =>
        t.id === updatedTask.id ? { ...t, ...updatedTask } : t
      )
  );

  const stageScore = (stage: number) => {
    return stageSummaries?.find((s: any) => s.stage === stage)?.score ?? null;
  };

  return (
    <StagesTab
      coreData={coreData}
      tasksData={{ stageSummaries, users, rcaReasons, delayReasons }}
      activeRole={activeRole}
      optimisticTasks={optimisticTasks}
      addOptimisticTask={addOptimisticTask}
      stageScore={stageScore}
    />
  );
}

function LedgerTabWrapper({ coreData, promises, activeRole }: any) {
  const { ledger } = use(promises.ledgerPromise as Promise<any>);
  return ledger ? (
    <LedgerTab caseId={coreData.case.id} activeRole={activeRole} ledger={ledger} />
  ) : (
    <div className="text-center py-12 text-muted-foreground text-sm">
      Ledger data unavailable. Case must be Approved or in a billing state.
    </div>
  );
}

export default function CaseWorkspace({ coreData, promises, initialActiveRole = 'viewer' }: any) {
  const c = coreData.case;
  const cycle = coreData.cycle;

  const [activeRole, setActiveRole] = useState<string>(initialActiveRole);

  const [showCounterOffer, setShowCounterOffer] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showPersonaChange, setShowPersonaChange] = useState(false);
  const isApproved = c.status === 'Approved';

  const liveScore = cycle?.current_case_score;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/cases" className="hover:text-foreground transition-colors">Cases</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">{c.case_number}</span>
          </div>
          <h1 className="text-xl font-bold">{c.case_number}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {c.customer?.legal_name || c.contractor?.legal_name || 'No party'} · {c.case_scenario?.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {c.substatus && <Badge variant="secondary">{c.substatus}</Badge>}
          <Badge variant={STATUS_VARIANT[c.status] || 'secondary'}>{c.status}</Badge>
          {c.status !== 'Closed' && c.status !== 'Expired' && c.status !== 'Withdrawn' && c.status !== 'Rejected' && (
            <div className="flex gap-2 print:hidden">
              <form action={handleWithdraw} className="print:hidden">
                <input type="hidden" name="caseId" value={c.id} />
                <input type="hidden" name="reason" value="Withdrawn by user" />
                <input type="hidden" name="note" value="Manual withdrawal" />
                <Button type="submit" variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10">Withdraw</Button>
              </form>

              {isApproved && (
                <Button
                  onClick={() => setShowCounterOffer(true)}
                  variant="default"
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  Negotiate Terms
                </Button>
              )}

              <Button
                onClick={() => setShowUnlock(true)}
                variant="outline"
                size="sm"
              >
                Unlock/Reopen
              </Button>

              {cycle && cycle.is_active && (
                 <Button
                   onClick={() => setShowPersonaChange(true)}
                   variant="outline"
                   size="sm"
                 >
                   Change Personas
                 </Button>
              )}
            </div>
          )}

          {c.status === 'Rejected' && (
            <form action={handleCreateApprovalRound} className="print:hidden">
              <input type="hidden" name="caseId" value={c.id} />
              <input type="hidden" name="cycleId" value={cycle.id} />
              <input type="hidden" name="stage" value="3" />
              <input type="hidden" name="roundType" value="appeal" />
              <Button type="submit" variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Scale size={15} className="mr-1.5" /> Appeal Decision
              </Button>
            </form>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            className="print:hidden ml-2" 
            onClick={() => window.print()}
          >
            <Printer size={15} className="mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      {['Approved', 'Accepted', 'Billing Active', 'Pending Write-Off Approval'].includes(c.status) && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-400">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} />
            <h3 className="font-semibold text-base">Credit Terms Approved</h3>
          </div>
          <p className="text-sm opacity-90">
            This case was approved with <strong>{cycle?.approved_credit_days || c.composite_credit_days}</strong> days of credit. 
            The Relationship Manager can proceed to the <strong>Ledger &amp; Billing</strong> tab to initiate billing.
          </p>
        </div>
      )}

      {liveScore !== null && liveScore !== undefined && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              <span className="text-sm font-medium">Live Score</span>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{liveScore}</p>
                <p className="text-xs text-muted-foreground">Composite Score</p>
              </div>
              {cycle?.approved_credit_days != null && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">{cycle.approved_credit_days}d</p>
                  <p className="text-xs text-muted-foreground">Approved Days</p>
                </div>
              )}
              {cycle?.is_ambiguous && (
                <Badge variant="warning" className="self-center">Ambiguous ⚠</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="mb-4 print:hidden">
          <TabsTrigger value="overview"><Layers size={14} className="mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="stages"><Shield size={14} className="mr-2" /> Stages</TabsTrigger>
          <TabsTrigger value="approvals"><Shield size={14} className="mr-2" /> Approvals</TabsTrigger>
          <TabsTrigger value="ledger"><Wallet size={14} className="mr-2" /> Ledger &amp; Billing</TabsTrigger>
          <TabsTrigger value="comments"><MessageSquare size={14} className="mr-2" /> Comments</TabsTrigger>
          <TabsTrigger value="audit"><History size={14} className="mr-2" /> Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading overview...</div>}>
            <OverviewTab
              coreData={coreData}
              promises={promises}
              activeRole={activeRole}
              liveScore={liveScore}
              showCounterOffer={showCounterOffer}
              setShowCounterOffer={setShowCounterOffer}
              showUnlock={showUnlock}
              setShowUnlock={setShowUnlock}
              showPersonaChange={showPersonaChange}
              setShowPersonaChange={setShowPersonaChange}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="stages">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading tasks...</div>}>
             <StagesTabWrapper coreData={coreData} promises={promises} activeRole={activeRole} liveScore={liveScore} />
          </Suspense>
        </TabsContent>

        <TabsContent value="approvals">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading approvals...</div>}>
            <ApprovalsTab coreData={coreData} promises={promises} activeRole={activeRole} />
          </Suspense>
        </TabsContent>

        <TabsContent value="ledger">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading ledger...</div>}>
             <LedgerTabWrapper coreData={coreData} promises={promises} activeRole={activeRole} />
          </Suspense>
        </TabsContent>

        <TabsContent value="comments">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading comments...</div>}>
            <CommentsTab coreData={coreData} promises={promises} />
          </Suspense>
        </TabsContent>

        <TabsContent value="audit">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading audit log...</div>}>
            <AuditTab promises={promises} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
