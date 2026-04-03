"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronRight, Clock, CheckCircle, AlertCircle,
  Layers, FileText, History, Shield, MessageSquare,
  BarChart3, TrendingUp, Award, Printer, Scale, Wallet
} from 'lucide-react';
import LedgerTab from './LedgerTab';
import { getImpersonationRole } from '@/utils/auth-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  handleProgressStage, handleCompleteTask, handleWithdraw,
  handleCreateApprovalRound, handleApprovalDecision, handleAddComment,
  handleSelectiveUnlock, handleCounterOffer, handleChangePersona, handleAssignTask
} from './actions';
import { cn } from '@/lib/utils';

interface CaseWorkspaceProps {
  data: {
    case: any;
    cycle: any;
    tasks: any[];
    auditEvents: any[];
    approvalRounds: any[];
    comments: any[];
    users?: any[];
    ledger: any | null;
    stageSummaries?: { stage: number; score: number | null; completedAt: string | null }[];
  };
}

const STATUS_VARIANT: Record<string, any> = {
  'Draft': 'secondary', 'In Review': 'warning', 'Awaiting Approval': 'warning',
  'Approved': 'success', 'Rejected': 'destructive', 'Withdrawn': 'secondary',
};

export default function CaseWorkspace({ data }: CaseWorkspaceProps) {
  const c = data.case;
  const cycle = data.cycle;
  const tasks = data.tasks;

  const [activeRole, setActiveRole] = useState<string>('');

  useEffect(() => {
    getImpersonationRole().then(r => setActiveRole(r || 'viewer'));
  }, []);

  const stageTasks = (s: number) => tasks.filter((t: any) => t.stage === s);
  const stageComplete = (s: number) => {
    const st = stageTasks(s);
    if (!st.length) return true; // Allow progression if no tasks for this stage
    return st.filter((t: any) => t.is_required).every((t: any) => t.status === 'Completed' || t.is_waived);
  };

  const [showCounterOffer, setShowCounterOffer] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showPersonaChange, setShowPersonaChange] = useState(false);
  const isApproved = c.status === 'Approved';

  // Calculate SLA display
  const submittedAt = c.submitted_at ? new Date(c.submitted_at) : null;
  const daysInReview = submittedAt ? Math.floor((Date.now() - submittedAt.getTime()) / (1000 * 3600 * 24)) : 0;

  // Live scoring: derive from completed scoring tasks
  const stageScore = (stage: number) => {
    const scoringTasks = stageTasks(stage).filter((t: any) => t.task_type === 'scoring' && t.status === 'Completed' && t.grade_value != null);
    if (!scoringTasks.length) return null;
    const totalWeight = scoringTasks.reduce((sum: number, t: any) => sum + (t.param?.weight || 1), 0);
    const weightedSum = scoringTasks.reduce((sum: number, t: any) => sum + (t.grade_value * (t.param?.weight || 1)), 0);
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  };

  const allStageScores = [1, 2, 3].map(s => stageScore(s)).filter(v => v != null) as number[];
  // Prioritize stored cycle score, fallback to live calculation
  const liveScore = cycle?.current_case_score ?? (allStageScores.length ? Math.round(allStageScores.reduce((a, b) => a + b, 0) / allStageScores.length) : null);

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
            <CheckCircle size={18} />
            <h3 className="font-semibold text-base">Credit Terms Approved</h3>
          </div>
          <p className="text-sm opacity-90">
            This case was approved with <strong>{cycle?.approved_credit_days || c.composite_credit_days}</strong> days of credit. 
            The Relationship Manager can proceed to the <strong>Ledger &amp; Billing</strong> tab to initiate billing.
          </p>
        </div>
      )}

      {/* Live Score Banner — shown when scoring has started */}
      {liveScore !== null && (
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
              {[1, 2, 3].map(s => {
                const sc = stageScore(s);
                return sc != null ? (
                  <div key={s} className="text-center">
                    <p className="text-lg font-semibold">{sc}</p>
                    <p className="text-xs text-muted-foreground">Stage {s}</p>
                  </div>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="mb-4 print:hidden">
          <TabsTrigger value="overview"><Layers size={14} className="mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="stages"><CheckCircle size={14} className="mr-2" /> Stages</TabsTrigger>
          <TabsTrigger value="approvals"><Shield size={14} className="mr-2" /> Approvals</TabsTrigger>
          <TabsTrigger value="ledger"><Wallet size={14} className="mr-2" /> Ledger &amp; Billing</TabsTrigger>
          <TabsTrigger value="comments"><MessageSquare size={14} className="mr-2" /> Comments</TabsTrigger>
          <TabsTrigger value="audit"><History size={14} className="mr-2" /> Audit Trail</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">

          {showPersonaChange && cycle && (
            <Card className="mb-4 bg-muted/20 border-border print:hidden">
              <CardContent className="p-4">
                <form action={handleChangePersona} className="space-y-3" onSubmit={() => setShowPersonaChange(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="cycleId" value={cycle.id} />
                  <h3 className="font-semibold text-sm">Change Personas & Dominance</h3>
                  <p className="text-xs text-muted-foreground mb-2">Update the evaluation models for this active cycle. Changes affect live scoring.</p>

                  <div className="flex gap-2 mb-2">
                    <Input name="customerPersonaId" placeholder="Customer Persona ID" defaultValue={cycle.customer_persona_id || ''} className="h-9 w-[200px]" />
                    <Input name="contractorPersonaId" placeholder="Contractor Persona ID" defaultValue={cycle.contractor_persona_id || ''} className="h-9 w-[200px]" />
                    <Input name="dominanceCategoryId" placeholder="Dominance Category ID" defaultValue={cycle.dominance_category_id || ''} className="h-9 flex-1" />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="default">Update Configuration</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowPersonaChange(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {showUnlock && (
            <Card className="mb-4 bg-muted/20 border-warning print:hidden">
              <CardContent className="p-4">
                <form action={handleSelectiveUnlock} className="space-y-3" onSubmit={() => setShowUnlock(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <h3 className="font-semibold text-sm">Selective Unlock</h3>
                  <p className="text-xs text-muted-foreground mb-2">Unlocking a section allows editing but requires a manual re-review if changes are material.</p>
                  <div className="flex gap-2 mb-2">
                    <select name="section" className="flex h-9 w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                      <option value="commercial">Commercial Section</option>
                      <option value="parties">Parties</option>
                      <option value="history">History Classification</option>
                    </select>
                    <Input name="reason" placeholder="Reason for unlock" className="h-9 flex-1" required />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="default">Unlock Section</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowUnlock(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {showCounterOffer && isApproved && (
            <Card className="mb-4 bg-card border-border print:hidden">
              <CardContent className="p-4">
                <form action={handleCounterOffer} className="space-y-3" onSubmit={() => setShowCounterOffer(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="cycleId" value={cycle?.id} />
                  <h3 className="font-semibold text-sm text-foreground">Counter-Offer / Negotiate Terms</h3>
                  <p className="text-xs text-muted-foreground mb-2">Approved Limit: <strong className="font-bold">{cycle?.approved_credit_days} days</strong>. You may restructure tranches to fit within this limit without requiring a new review.</p>

                  <div className="flex items-center gap-2 mb-2">
                    <Input type="number" name="compositeDays" placeholder="New Composite Days" className="h-9 w-[200px]" required max={cycle?.approved_credit_days} />
                    <span className="text-xs text-muted-foreground">(Must be ≤ {cycle?.approved_credit_days})</span>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" name="outcome" value="accepted" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">Accept New Terms</Button>
                    <Button type="submit" name="outcome" value="dropped" size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">Customer Declined</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowCounterOffer(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Commercial Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Bill Amount', value: `₹${(c.bill_amount || 0).toLocaleString('en-IN')}` },
                  { label: 'Requested Exposure', value: `₹${(c.requested_exposure_amount || 0).toLocaleString('en-IN')}` },
                  { label: 'Composite Days', value: `${c.composite_credit_days || 0} days` },
                  { label: 'Branch', value: c.branch?.name || '—' },
                ].map(d => (
                  <div key={d.label}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{d.label}</p>
                    <p className="font-semibold">{d.value}</p>
                  </div>
                ))}
                {c.proposed_tranches && c.proposed_tranches.length > 0 && (
                  <div className="col-span-2">
                    <Separator className="my-3" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tranches</p>
                    <div className="space-y-1">
                      {c.proposed_tranches.map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{t.type}</span>
                          <span>{t.type === 'percentage' ? `${t.value}%` : `₹${t.value?.toLocaleString('en-IN')}`}</span>
                          <span className="text-muted-foreground">{t.days_after_billing}d after billing</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">People</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {[
                  { label: 'RM', value: c.rm?.full_name || '—' },
                  { label: 'KAM', value: c.kam?.full_name || 'Unassigned' },
                  { label: 'Customer', value: c.customer?.legal_name || '—' },
                  { label: 'Contractor', value: c.contractor?.legal_name || '—' },
                ].map(d => (
                  <div key={d.label}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{d.label}</p>
                    <p className="font-semibold">{d.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {cycle && (
              <Card className="col-span-2">
                <CardHeader className="pb-3"><CardTitle className="text-base">Review Cycle #{cycle.cycle_number}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Current Stage', value: `Stage ${cycle.active_stage}` },
                    { label: 'Case Score', value: cycle.current_case_score ?? liveScore ?? '—' },
                    { label: 'Approved Days', value: cycle.approved_credit_days ? `${cycle.approved_credit_days}d` : '—' },
                    { label: 'Status', value: cycle.is_ambiguous ? 'Ambiguous ⚠' : 'Normal' },
                  ].map(d => (
                    <div key={d.label}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{d.label}</p>
                      <p className="font-semibold">{d.value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="col-span-2 border-border">
              <CardHeader className="pb-3 border-b border-border/50"><CardTitle className="text-base text-foreground">Party History & Exposure</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h4 className="text-sm font-semibold mb-3 border-b pb-1">Customer: {c.customer?.legal_name || 'N/A'}</h4>
                  {c.customer_exposure ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outstanding</span>
                        <span className="font-semibold">₹{(c.customer_exposure.outstanding_amount || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Overdue</span>
                        <span className={c.customer_exposure.overdue_amount > 0 ? "text-destructive font-bold" : "font-semibold"}>₹{(c.customer_exposure.overdue_amount || 0).toLocaleString('en-IN')} ({c.customer_exposure.overdue_days} days)</span>
                      </div>
                      {c.customer_history && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Orders</span>
                            <span className="font-semibold">{c.customer_history.order_count || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Avg Delay</span>
                            <span className="font-semibold">{c.customer_history.average_delay_days || 0} days</span>
                          </div>
                        </>
                      )}
                      <p className="text-tiny text-muted-foreground pt-1">Data as of: {new Date(c.customer_exposure.data_as_of).toLocaleDateString()}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No historical exposure found.</p>
                  )}
                </div>

                {c.contractor && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 border-b pb-1">Contractor: {c.contractor.legal_name}</h4>
                    {c.contractor_exposure ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Outstanding</span>
                          <span className="font-semibold">₹{(c.contractor_exposure.outstanding_amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Overdue</span>
                          <span className={c.contractor_exposure.overdue_amount > 0 ? "text-destructive font-bold" : "font-semibold"}>₹{(c.contractor_exposure.overdue_amount || 0).toLocaleString('en-IN')} ({c.contractor_exposure.overdue_days} days)</span>
                        </div>
                        {c.contractor_history && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Orders</span>
                              <span className="font-semibold">{c.contractor_history.order_count || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Avg Delay</span>
                              <span className="font-semibold">{c.contractor_history.average_delay_days || 0} days</span>
                            </div>
                          </>
                        )}
                        <p className="text-tiny text-muted-foreground pt-1">Data as of: {new Date(c.contractor_exposure.data_as_of).toLocaleDateString()}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No historical exposure found.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Realized Outcome — superseded by Ledger & Billing tab */}

          </div>
        </TabsContent>

        {/* Stages Tab */}
        <TabsContent value="stages">
          {!cycle ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No active review cycle.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3].map(stage => {
                const st = stageTasks(stage);
                const isCurrent = cycle.active_stage === stage;
                const isPast = cycle.active_stage > stage;
                const sc = stageScore(stage);
                return (
                  <Card key={stage} className={cn(isCurrent && "border-primary/60")}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        {isPast
                          ? <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                          : isCurrent
                            ? <Clock size={18} className="text-amber-400 shrink-0" />
                            : <AlertCircle size={18} className="text-muted-foreground shrink-0" />
                        }
                        <CardTitle className="text-base flex-1">Stage {stage}</CardTitle>
                        <span className="text-xs text-muted-foreground">{st.filter((t: any) => t.status === 'Completed').length}/{st.length} tasks</span>
                        {sc != null && (
                          <Badge variant="info" className="flex items-center gap-1">
                            <Award size={12} /> Score: {sc}
                          </Badge>
                        )}
                        {isCurrent && stageComplete(stage) && cycle.active_stage < 3 && (
                          <form action={handleProgressStage}>
                            <input type="hidden" name="cycleId" value={cycle.id} />
                            <input type="hidden" name="currentStage" value={stage} />
                            <input type="hidden" name="caseId" value={c.id} />
                            <Button type="submit" size="sm">Progress to Stage {stage + 1}</Button>
                          </form>
                        )}
                        {isCurrent && stageComplete(stage) && (
                          <form action={handleCreateApprovalRound}>
                            <input type="hidden" name="cycleId" value={cycle.id} />
                            <input type="hidden" name="stage" value={stage} />
                            <input type="hidden" name="caseId" value={c.id} />
                            <Button type="submit" size="sm" variant="outline">Request Approval</Button>
                          </form>
                        )}
                      </div>
                    </CardHeader>
                    {st.length > 0 && (
                      <CardContent className="pt-0">
                        <div className="divide-y divide-border">
                          {st.map((task: any) => (
                            <div key={task.id} className="flex items-center gap-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <Badge variant={task.status === 'Completed' ? 'success' : 'secondary'} className="text-xs">
                                    {task.status}
                                  </Badge>
                                  {task.task_type === 'scoring' && <Badge variant="info" className="text-xs">Scoring</Badge>}
                                  {task.is_waiting && <Badge variant="warning" className="text-xs">⏸ Waiting</Badge>}
                                </div>
                                <p className="text-sm">{task.description}</p>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                  {task.status !== 'Completed' && (activeRole === 'founder_admin' || activeRole === 'kam') ? (
                                    <form action={handleAssignTask} className="flex items-center gap-2">
                                      <input type="hidden" name="taskId" value={task.id} />
                                      <input type="hidden" name="caseId" value={c.id} />
                                      <select
                                        name="assigneeId"
                                        defaultValue={task.assigned_to || ""}
                                        onChange={(e) => e.target.form?.requestSubmit()}
                                        className="h-6 text-xs bg-background border border-input rounded px-1"
                                      >
                                        <option value="">Unassigned</option>
                                        {data.users?.map((u: any) => (
                                          <option key={u.id} value={u.id}>{u.full_name}</option>
                                        ))}
                                      </select>
                                    </form>
                                  ) : (
                                    <span>{task.assigned?.full_name || 'Unassigned'}</span>
                                  )}
                                  {task.grade_value != null && <span>· Grade: {task.grade_value}</span>}
                                  {task.reason && <span>· {task.reason}</span>}
                                </div>
                              </div>
                              {task.status === 'Pending' && isCurrent && (activeRole === 'founder_admin' || !task.param?.default_owning_role || task.param.default_owning_role === activeRole) && (
                                <form action={handleCompleteTask} className="flex items-center gap-2 shrink-0">
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <input type="hidden" name="caseId" value={c.id} />
                                  {task.task_type === 'scoring' && (
                                    <>
                                      {task.param?.input_type === 'grade_select' || task.param?.input_type === 'yes_no' ? (
                                        <select
                                          name="gradeValue"
                                          className="flex h-8 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
                                        >
                                          <option value="">-- Select --</option>
                                          {task.param.input_type === 'yes_no' ? (
                                            <>
                                              <option value="1">Yes</option>
                                              <option value="0">No</option>
                                            </>
                                          ) : (
                                            Array.from({ length: 10 }, (_, i) => (
                                              <option key={i + 1} value={i + 1}>{i + 1}</option>
                                            ))
                                          )}
                                        </select>
                                      ) : task.param?.input_type === 'dropdown' || task.param?.input_type === 'link_list' ? (
                                        <select
                                          name="rawInput"
                                          className="flex h-8 w-28 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
                                        >
                                          <option value="">-- Select --</option>
                                          {task.param.auto_band_config?.mappings?.map((m: any, i: number) => (
                                            <option key={i} value={m.value}>{m.value}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <Input
                                          type={task.param?.input_type === 'numeric' ? 'number' : task.param?.input_type === 'date' ? 'date' : 'text'}
                                          name="rawInput"
                                          placeholder={task.param?.input_type === 'numeric' ? 'Value' : task.param?.input_type === 'date' ? '' : 'Text value'}
                                          className="w-24 h-8 text-xs"
                                        />
                                      )}
                                      <Input name="reason" placeholder="Reason" className="w-28 h-8 text-xs" />
                                    </>
                                  )}
                                  <Button type="submit" size="sm">Complete</Button>
                                </form>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                    {st.length === 0 && (
                      <CardContent className="pt-0 pb-4">
                        <p className="text-sm text-muted-foreground italic">No tasks configured for this stage.</p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals">
          {data.approvalRounds.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No approval rounds yet. Complete all tasks for a stage and click "Request Approval".</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {data.approvalRounds.map((round: any) => (
                <Card key={round.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Round #{round.round_number || 1} — Stage {round.stage}</CardTitle>
                      <Badge variant={round.status === 'approved' ? 'success' : round.status === 'rejected' ? 'destructive' : round.status === 'open' ? 'warning' : 'secondary'}>
                        {round.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {round.decisions?.map((d: any) => (
                      <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{d.approver?.full_name || 'Unknown'}</span>
                            <Badge variant={d.decision === 'approve' ? 'success' : d.decision === 'reject' ? 'destructive' : 'warning'} className="text-xs capitalize">
                              {d.decision?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          {d.comment && <p className="text-sm text-muted-foreground">{d.comment}</p>}
                        </div>
                      </div>
                    ))}
                    {round.status === 'open' && (
                      <form action={handleApprovalDecision} className="space-y-3 pt-2">
                        <input type="hidden" name="roundId" value={round.id} />
                        <input type="hidden" name="caseId" value={c.id} />
                        <Input name="comment" placeholder="Comment (optional)" />
                        <div className="flex gap-2">
                          <Button type="submit" name="decision" value="approve">Approve</Button>
                          <Button type="submit" name="decision" value="reject" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">Reject</Button>
                          <Button type="submit" name="decision" value="return_for_revision" variant="outline">Return for Revision</Button>
                        </div>
                      </form>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Ledger & Billing Tab */}
        <TabsContent value="ledger">
          {data.ledger ? (
            <LedgerTab
              caseId={c.id}
              activeRole={activeRole}
              ledger={data.ledger}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Ledger data unavailable. Case must be Approved or in a billing state.
            </div>
          )}
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments">
          <div className="space-y-4">
            <Card className="print:hidden">
            <CardContent className="p-4 bg-muted/30">
              <form action={handleAddComment} className="flex gap-2 items-start">
                  <input type="hidden" name="caseId" value={c.id} />
                  <Input name="content" placeholder="Add a comment..." className="flex-1" required />
                  <Button type="submit" size="sm">Post</Button>
                </form>
              </CardContent>
            </Card>
            {data.comments.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No comments yet.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {data.comments.map((cm: any) => (
                  <Card key={cm.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-medium">{cm.author?.full_name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">{new Date(cm.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm">{cm.body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit">
          {data.auditEvents.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No audit events yet.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="relative pl-6 space-y-0">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  {data.auditEvents.map((e: any) => (
                    <div key={e.id} className="relative pb-5 last:pb-0">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                      <p className="text-sm font-medium leading-tight">{e.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.actor?.full_name || 'System'} · {new Date(e.created_at).toLocaleString()}
                      </p>
                      {e.field_diffs && (
                        <pre className="mt-1.5 text-xs bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(e.field_diffs, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
