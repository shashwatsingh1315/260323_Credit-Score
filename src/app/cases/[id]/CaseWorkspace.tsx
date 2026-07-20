"use client";
import { useState, useOptimistic, Suspense, use } from 'react';
import Link from 'next/link';
import {
  ChevronRight, LayoutDashboard, ListChecks, Scale, MessageSquare,
  BarChart3, Printer, Wallet, History, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { handleWithdraw, handleCreateApprovalRound } from './actions';
import dynamic from 'next/dynamic';
import { StatusBadge } from '@/components/creditflow/StatusBadge';
import { MacroProgressRail } from '@/components/creditflow/MacroProgressRail';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { getStatusMeta, describeScenario } from '@/lib/vocabulary';
import { formatCompactINR } from '@/lib/format';

const LedgerTab = dynamic(() => import('./LedgerTab'));
const OverviewTab = dynamic(() => import('./OverviewTab'));
const StagesTab = dynamic(() => import('./StagesTab'));
const ApprovalsTab = dynamic(() => import('./ApprovalsTab'));
const CommentsTab = dynamic(() => import('./CommentsTab'));
const AuditTab = dynamic(() => import('./AuditTab'));

/**
 * Case workspace — doctrine §12.4. The persistent header is a command bar:
 * identity, commercial request, macro progress, current owner, next action,
 * SLA/blocker. Tabs adapt to role and lifecycle; content follows the
 * Summary / Work / Decision / Financials / Conversation / History model.
 */

function StagesTabWrapper({ coreData, promises, activeRole }: any) {
  const { tasks, stageSummaries, users, rcaReasons, delayReasons, gradeScale } = use(promises.tasksPromise as Promise<any>);

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
      tasksData={{ stageSummaries, users, rcaReasons, delayReasons, gradeScale }}
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
    <div className="text-center py-12 text-muted-foreground text-sm space-y-1">
      <p className="font-medium text-foreground">No financial record yet</p>
      <p>Billing starts once terms are approved and accepted. The ledger will then track decided, promised, collected and outstanding amounts.</p>
    </div>
  );
}

/** Open decision-round count shown on the Decision tab (doctrine §12.4). */
function DecisionCountBadge({ promise }: { promise: Promise<any> }) {
  const { approvalRounds } = use(promise);
  const open = (approvalRounds || []).filter((r: any) => r.status === 'open').length;
  if (open === 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-warning/20 text-warning text-[10px] font-bold">
      {open}
    </span>
  );
}

const TERMINAL = ['Closed', 'Expired', 'Withdrawn', 'Rejected'];

export default function CaseWorkspace({ coreData, promises, initialActiveRole = 'viewer', receipt }: any) {
  const c = coreData.case;
  const cycle = coreData.cycle;

  const [activeRole] = useState<string>(initialActiveRole);
  const [showCounterOffer, setShowCounterOffer] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showPersonaChange, setShowPersonaChange] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const isApproved = c.status === 'Approved';
  const meta = getStatusMeta(c.status);
  const liveScore = cycle?.current_case_score;
  const isBillingOrLater = ['Accepted', 'Billing Active', 'Pending Write-Off Approval', 'Closed'].includes(c.status);
  const isTerminal = TERMINAL.includes(c.status);
  const isApprovalExpired = !!cycle?.validity_expires_at
    && new Date(cycle.validity_expires_at).getTime() < new Date(coreData.renderedAt).getTime()
    && ['Approved'].includes(c.status);

  // Terms layers — never collapse recommendation into "approved" (Principle 4).
  const recommendedDays = cycle?.approved_credit_days; // score-band output
  const hasHumanApproval = isBillingOrLater || c.status === 'Approved';

  // Default tab adapts to role and lifecycle (Principle 7).
  const defaultTab = (() => {
    if (c.status === 'Draft') return 'summary';
    if (['Awaiting Approval', 'Appealed'].includes(c.status)) return 'decision';
    if (['bdo', 'accounts'].includes(activeRole) && c.status === 'In Review') return 'work';
    if (['Billing Active', 'Pending Write-Off Approval'].includes(c.status) && ['kam', 'accounts', 'founder_admin'].includes(activeRole)) return 'financials';
    return 'summary';
  })();

  // Current owner for the command bar.
  const ownerName = meta.ownerRole === 'rm' ? c.rm?.full_name
    : meta.ownerRole === 'kam' ? c.kam?.full_name
    : null;

  const railDetail = (() => {
    if (c.status === 'In Review' && cycle) return `Stage ${cycle.active_stage} of 3 · ${meta.nextAction}`;
    if (c.status === 'Awaiting Input' && c.substatus) return `Waiting: ${c.substatus}`;
    return null;
  })();

  return (
    <div className="space-y-4 max-w-6xl">
      {/* ── Receipt: feedback confirms the business outcome (Principle 13) ── */}
      {receipt === 'submitted' && (
        <div role="status" className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
          <p className="font-semibold text-success">Case submitted for review</p>
          <p className="text-foreground/80 mt-0.5">
            Stage 1 tasks have been created and the KAM has been notified. You will be alerted if the case is returned for revision.
          </p>
        </div>
      )}
      {receipt === 'draft' && (
        <div role="status" className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="font-semibold text-foreground">Draft saved</p>
          <p className="text-muted-foreground mt-0.5">
            This case is saved but not yet submitted. Complete the remaining sections and submit when ready.
          </p>
        </div>
      )}

      {/* ── Case command bar ───────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cases" className="hover:text-foreground transition-colors">Cases</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="text-foreground font-medium">{c.case_number}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{c.customer?.legal_name || c.contractor?.legal_name || 'No party'}</h1>
            <p className="text-sm text-muted-foreground">
              {c.case_number} · {describeScenario(c.case_scenario)}
            </p>
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <StatusBadge status={c.status} substatus={c.substatus} />
              {cycle?.is_ambiguous && (
                <Badge variant="attention" className="text-xs">Ambiguity — board review</Badge>
              )}
              {isApprovalExpired && <Badge variant="attention" className="text-xs">Approval expired</Badge>}
            </div>
          </div>

          {/* Header actions — one primary path; destructive behind consequence preview */}
          <div className="flex items-center gap-2 print:hidden flex-wrap">
            {isApproved && (
              <Button onClick={() => setShowCounterOffer(true)} size="sm">
                Record accepted terms
              </Button>
            )}
            {c.status === 'Rejected' && cycle && (
              <form action={handleCreateApprovalRound}>
                <input type="hidden" name="caseId" value={c.id} />
                <input type="hidden" name="cycleId" value={cycle.id} />
                <input type="hidden" name="stage" value="3" />
                <input type="hidden" name="roundType" value="appeal" />
                <Button type="submit" size="sm">
                  <Scale size={15} className="mr-1.5" aria-hidden="true" /> Appeal decision
                </Button>
              </form>
            )}
            {!isTerminal && (
              <>
                <Button onClick={() => setShowUnlock(true)} variant="outline" size="sm">Unlock / reopen</Button>
                {cycle && cycle.is_active && (
                  <Button onClick={() => setShowPersonaChange(true)} variant="outline" size="sm">Change personas</Button>
                )}
                <Button onClick={() => setShowWithdrawConfirm(true)} variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10">
                  Withdraw
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" className="print:hidden" onClick={() => window.print()}>
              <Printer size={15} className="mr-1.5" aria-hidden="true" /> Print
            </Button>
          </div>
        </div>
      </div>

      {/* Withdraw — consequence preview, reason preserved (Principle 10) */}
      <ConfirmDialog
        open={showWithdrawConfirm}
        onOpenChange={setShowWithdrawConfirm}
        title={`Withdraw ${c.case_number}?`}
        description="Withdrawing ends this credit request."
        tone="destructive"
        irreversible
        requireReason
        confirmLabel="Withdraw case"
        consequences={[
          'The case will move to Withdrawn and cannot be edited.',
          'Open tasks and approval rounds will no longer require action.',
          'The RM and KAM will be notified.',
          'A new case is required if the deal becomes live again.',
        ]}
        action={handleWithdraw}
        hiddenFields={{ caseId: c.id, note: 'Withdrawn from case workspace' }}
      />

      {/* ── Progress + command facts ───────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <MacroProgressRail status={c.status} detail={railDetail} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 pt-3 border-t border-border/60 text-sm">
            <div>
              <p className="text-tiny uppercase tracking-wider text-muted-foreground">Bill amount</p>
              <p className="font-semibold tabular-nums mt-0.5">{formatCompactINR(c.bill_amount)}</p>
            </div>
            <div>
              <p className="text-tiny uppercase tracking-wider text-muted-foreground" title="What the RM proposed">Requested terms</p>
              <p className="font-semibold tabular-nums mt-0.5">{c.composite_credit_days || 0} days</p>
            </div>
            <div>
              <p className="text-tiny uppercase tracking-wider text-muted-foreground">Current owner</p>
              <p className="font-semibold mt-0.5 truncate">
                {ownerName || (meta.ownerRole ? 'Unassigned' : '—')}
                {meta.ownerRole && <span className="block text-tiny font-normal text-muted-foreground">{meta.ownerRole.replace(/_/g, ' ')}</span>}
              </p>
            </div>
            <div>
              <p className="text-tiny uppercase tracking-wider text-muted-foreground">Next action</p>
              <p className="font-semibold mt-0.5 text-sm leading-snug">{meta.nextAction}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Score — explained, never a bare number (Principle 5) ──────────── */}
      {liveScore !== null && liveScore !== undefined && (
        <Card className="border-primary/25">
          <CardContent className="p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 size={17} className="text-primary" aria-hidden="true" />
              Policy score
              <span className="text-xs text-muted-foreground font-normal">(0–100, higher is safer)</span>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold text-primary tabular-nums">{liveScore}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                <p className="text-tiny text-muted-foreground">Composite score</p>
              </div>
              {recommendedDays != null && (
                <div>
                  <p className="text-2xl font-bold tabular-nums">{recommendedDays}d</p>
                  <p className="text-tiny text-muted-foreground">
                    {hasHumanApproval ? 'Approved terms' : 'Policy recommendation — not yet approved'}
                  </p>
                </div>
              )}
              {cycle?.score_band_name && (
                <div>
                  <p className="text-sm font-semibold">{cycle.score_band_name}</p>
                  <p className="text-tiny text-muted-foreground">Score band</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5 max-w-sm ml-auto">
              <Info size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
              The score is a policy signal, not a decision. Approved terms are set by the authorized approver.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Content tabs: Summary / Work / Decision / Financials / Conversation / History ── */}
      <Tabs defaultValue={defaultTab} className="mt-2">
        <TabsList className="mb-4 print:hidden flex-wrap h-auto gap-1">
          <TabsTrigger value="summary"><LayoutDashboard size={14} className="mr-1.5" aria-hidden="true" /> Summary</TabsTrigger>
          <TabsTrigger value="work"><ListChecks size={14} className="mr-1.5" aria-hidden="true" /> Work</TabsTrigger>
          <TabsTrigger value="decision">
            <Scale size={14} className="mr-1.5" aria-hidden="true" /> Decision
            <Suspense fallback={null}>
              <DecisionCountBadge promise={promises.approvalsPromise} />
            </Suspense>
          </TabsTrigger>
          <TabsTrigger value="financials"><Wallet size={14} className="mr-1.5" aria-hidden="true" /> Financials</TabsTrigger>
          <TabsTrigger value="conversation"><MessageSquare size={14} className="mr-1.5" aria-hidden="true" /> Conversation</TabsTrigger>
          <TabsTrigger value="history"><History size={14} className="mr-1.5" aria-hidden="true" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading summary…</div>}>
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

        <TabsContent value="work">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading tasks…</div>}>
            <StagesTabWrapper coreData={coreData} promises={promises} activeRole={activeRole} />
          </Suspense>
        </TabsContent>

        <TabsContent value="decision">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading decision…</div>}>
            <ApprovalsTab coreData={coreData} promises={promises} activeRole={activeRole} />
          </Suspense>
        </TabsContent>

        <TabsContent value="financials">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading financials…</div>}>
            <LedgerTabWrapper coreData={coreData} promises={promises} activeRole={activeRole} />
          </Suspense>
        </TabsContent>

        <TabsContent value="conversation">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading conversation…</div>}>
            <CommentsTab coreData={coreData} promises={promises} />
          </Suspense>
        </TabsContent>

        <TabsContent value="history">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading history…</div>}>
            <AuditTab promises={promises} />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Accepted-terms banner kept for print context */}
      {['Approved', 'Accepted', 'Billing Active', 'Pending Write-Off Approval'].includes(c.status) && (
        <p className="hidden print:block text-sm">
          Approved terms: {recommendedDays || c.composite_credit_days} days of credit.
        </p>
      )}
    </div>
  );
}
