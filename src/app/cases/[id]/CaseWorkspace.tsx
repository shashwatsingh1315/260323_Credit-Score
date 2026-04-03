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
  const [activeRole, setActiveRole] = useState<string>('');
  const [showCounterOffer, setShowCounterOffer] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showPersonaChange, setShowPersonaChange] = useState(false);

  useEffect(() => {
    getImpersonationRole().then(r => setActiveRole(r || 'viewer'));
  }, []);

  const c = data.case;
  const cycle = data.cycle;
  const tasks = data.tasks;

  const stageTasks = (s: number) => tasks.filter((t: any) => t.stage === s);
  const stageComplete = (s: number) => {
    const st = stageTasks(s);
    if (!st.length) return true; // Allow progression if no tasks for this stage
    return st.filter((t: any) => t.is_required).every((t: any) => t.status === 'Completed' || t.is_waived);
  };
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
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium tracking-wide">
            <Link href="/cases" className="hover:text-primary transition-colors">Cases</Link>
            <ChevronRight size={14} />
            <span className="text-foreground">{c.case_number}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{c.case_number}</h1>
          <p className="text-base text-muted-foreground capitalize flex items-center gap-2">
            <span className="font-medium text-foreground">{c.customer?.legal_name || c.contractor?.legal_name || 'No party'}</span>
            <span className="opacity-50">·</span>
            {c.case_scenario?.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {c.substatus && <Badge variant="secondary" className="h-7 px-3 text-xs font-bold rounded-lg uppercase tracking-wider">{c.substatus}</Badge>}
          <Badge variant={STATUS_VARIANT[c.status] || 'secondary'} className="h-7 px-3 text-xs font-bold rounded-lg uppercase tracking-wider">{c.status}</Badge>

          <div className="flex gap-2 print:hidden ml-2 border-l border-border/50 pl-4">
            {c.status !== 'Closed' && c.status !== 'Expired' && c.status !== 'Withdrawn' && c.status !== 'Rejected' && (
              <>
                <form action={handleWithdraw} className="print:hidden">
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="reason" value="Withdrawn by user" />
                  <input type="hidden" name="note" value="Manual withdrawal" />
                  <Button type="submit" variant="outline" size="sm" className="h-9 rounded-lg border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors font-semibold">Withdraw</Button>
                </form>

                {isApproved && (
                  <Button
                    onClick={() => setShowCounterOffer(true)}
                    variant="default"
                    size="sm"
                    className="h-9 rounded-lg bg-primary hover:bg-primary/90 font-bold shadow-sm transition-all"
                  >
                    Negotiate Terms
                  </Button>
                )}

                <Button
                  onClick={() => setShowUnlock(true)}
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg font-semibold bg-background hover:bg-muted"
                >
                  Unlock/Reopen
                </Button>

                {cycle && cycle.is_active && (
                   <Button
                     onClick={() => setShowPersonaChange(true)}
                     variant="outline"
                     size="sm"
                     className="h-9 rounded-lg font-semibold bg-background hover:bg-muted"
                   >
                     Change Personas
                   </Button>
                )}
              </>
            )}

            {c.status === 'Rejected' && (
              <form action={handleCreateApprovalRound} className="print:hidden">
                <input type="hidden" name="caseId" value={c.id} />
                <input type="hidden" name="cycleId" value={cycle.id} />
                <input type="hidden" name="stage" value="3" />
                <input type="hidden" name="roundType" value="appeal" />
                <Button type="submit" variant="default" size="sm" className="h-9 rounded-lg bg-primary hover:bg-primary/90 font-bold shadow-sm transition-all text-primary-foreground">
                  <Scale size={15} className="mr-1.5" /> Appeal Decision
                </Button>
              </form>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-lg font-semibold bg-background hover:bg-muted ml-1"
              onClick={() => window.print()}
            >
              <Printer size={15} className="mr-1.5" /> Export PDF
            </Button>
          </div>
        </div>
      </div>

      {['Approved', 'Accepted', 'Billing Active', 'Pending Write-Off Approval'].includes(c.status) && (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-6 text-success shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={22} className="text-success" />
            <h3 className="font-bold text-lg tracking-tight">Credit Terms Approved</h3>
          </div>
          <p className="text-sm font-medium opacity-90 pl-8 leading-relaxed">
            This case was approved with <strong className="font-bold text-base">{cycle?.approved_credit_days || c.composite_credit_days}</strong> days of credit.
            The Relationship Manager can proceed to the <strong className="font-bold border-b border-success/30 pb-0.5">Ledger &amp; Billing</strong> tab to initiate billing.
          </p>
        </div>
      )}

      {/* Live Score Banner — shown when scoring has started */}
      {liveScore !== null && (
        <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-md backdrop-blur-md overflow-hidden">
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 size={24} className="text-primary" />
              </div>
              <div>
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-1">Live Score</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tighter text-foreground">{liveScore}</span>
                  <span className="text-sm font-medium text-muted-foreground">composite points</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-8 md:gap-12 relative z-10">
              {cycle?.approved_credit_days != null && (
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-success">{cycle.approved_credit_days}<span className="text-lg text-success/70 font-medium">d</span></p>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Approved Days</p>
                </div>
              )}
              {cycle?.is_ambiguous && (
                <div className="self-center">
                  <Badge variant="warning" className="h-8 px-4 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm">Ambiguous ⚠</Badge>
                </div>
              )}
              <div className="flex gap-6 border-l border-border/50 pl-6 md:pl-12">
                {[1, 2, 3].map(s => {
                  const sc = stageScore(s);
                  return sc != null ? (
                    <div key={s} className="space-y-1">
                      <p className="text-2xl font-bold text-foreground">{sc}</p>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Stage {s}</p>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="mt-10">
        <TabsList className="mb-8 print:hidden h-14 bg-muted/40 p-1 rounded-2xl w-full justify-start overflow-x-auto flex-nowrap border border-border/40 shadow-inner">
          <TabsTrigger value="overview" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-semibold"><Layers size={16} className="mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="stages" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-semibold"><CheckCircle size={16} className="mr-2" /> Stages</TabsTrigger>
          <TabsTrigger value="approvals" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-semibold"><Shield size={16} className="mr-2" /> Approvals</TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-semibold"><Wallet size={16} className="mr-2" /> Ledger &amp; Billing</TabsTrigger>
          <TabsTrigger value="comments" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-semibold"><MessageSquare size={16} className="mr-2" /> Comments</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-semibold"><History size={16} className="mr-2" /> Audit Trail</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="focus:outline-none focus-visible:ring-0">

          {showPersonaChange && cycle && (
            <Card className="mb-6 rounded-2xl bg-muted/30 border-border/60 shadow-sm print:hidden backdrop-blur-sm">
              <CardContent className="p-6">
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

                  <div className="flex gap-3">
                    <Button type="submit" size="sm" variant="default" className="h-9 px-4 rounded-lg font-semibold shadow-sm">Update Configuration</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-9 px-4 rounded-lg font-semibold hover:bg-muted" onClick={() => setShowPersonaChange(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {showUnlock && (
            <Card className="mb-6 rounded-2xl bg-warning/5 border-warning/30 shadow-sm print:hidden backdrop-blur-sm">
              <CardContent className="p-6">
                <form action={handleSelectiveUnlock} className="space-y-4" onSubmit={() => setShowUnlock(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-warning">Selective Unlock</h3>
                    <p className="text-sm text-warning/80 font-medium">Unlocking a section allows editing but requires a manual re-review if changes are material.</p>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <select name="section" className="flex h-11 w-[220px] rounded-xl border border-warning/40 bg-warning/10 px-3 py-1 text-sm shadow-sm outline-none focus:ring-1 focus:ring-warning">
                      <option value="commercial">Commercial Section</option>
                      <option value="parties">Parties</option>
                      <option value="history">History Classification</option>
                    </select>
                    <Input name="reason" placeholder="Reason for unlock" className="h-11 flex-1 rounded-xl bg-background border-warning/40 focus:ring-warning" required />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" size="sm" variant="default" className="h-9 px-4 rounded-lg font-bold bg-warning hover:bg-warning/90 text-warning-foreground shadow-sm">Unlock Section</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-9 px-4 rounded-lg font-semibold hover:bg-warning/20 text-warning" onClick={() => setShowUnlock(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {showCounterOffer && isApproved && (
            <Card className="mb-6 rounded-2xl bg-card border-border/60 shadow-sm print:hidden">
              <CardContent className="p-6">
                <form action={handleCounterOffer} className="space-y-4" onSubmit={() => setShowCounterOffer(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="cycleId" value={cycle?.id} />
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-foreground">Counter-Offer / Negotiate Terms</h3>
                    <p className="text-sm text-muted-foreground font-medium">Approved Limit: <strong className="font-bold text-foreground">{cycle?.approved_credit_days} days</strong>. You may restructure tranches to fit within this limit without requiring a new review.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Input type="number" name="compositeDays" placeholder="New Composite Days" className="h-11 w-[220px] rounded-xl bg-muted/40" required max={cycle?.approved_credit_days} />
                    <span className="text-sm text-muted-foreground font-medium">(Must be ≤ {cycle?.approved_credit_days})</span>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" name="outcome" value="accepted" size="sm" className="h-9 px-4 rounded-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">Accept New Terms</Button>
                    <Button type="submit" name="outcome" value="dropped" size="sm" variant="outline" className="h-9 px-4 rounded-lg font-bold border-destructive/50 text-destructive hover:bg-destructive/10">Customer Declined</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-9 px-4 rounded-lg font-semibold hover:bg-muted" onClick={() => setShowCounterOffer(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-4 border-b border-border/30">
                <CardTitle className="text-lg font-bold tracking-tight">Commercial Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  {[
                    { label: 'Bill Amount', value: `₹${(c.bill_amount || 0).toLocaleString('en-IN')}` },
                    { label: 'Requested Exposure', value: `₹${(c.requested_exposure_amount || 0).toLocaleString('en-IN')}` },
                    { label: 'Composite Days', value: `${c.composite_credit_days || 0} days` },
                    { label: 'Branch', value: c.branch?.name || '—' },
                  ].map(d => (
                    <div key={d.label} className="space-y-1.5">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{d.label}</p>
                      <p className="font-semibold text-foreground text-base">{d.value}</p>
                    </div>
                  ))}
                </div>
                {c.proposed_tranches && c.proposed_tranches.length > 0 && (
                  <div className="mt-8">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-1 bg-border/50"></div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tranches</p>
                      <div className="h-px flex-1 bg-border/50"></div>
                    </div>
                    <div className="space-y-2 bg-muted/20 p-4 rounded-xl border border-border/40">
                      {c.proposed_tranches.map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground font-medium capitalize">{t.type}</span>
                          <span className="font-bold">{t.type === 'percentage' ? `${t.value}%` : `₹${t.value?.toLocaleString('en-IN')}`}</span>
                          <span className="text-muted-foreground font-medium">{t.days_after_billing}d after billing</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-4 border-b border-border/30">
                <CardTitle className="text-lg font-bold tracking-tight">People</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  {[
                    { label: 'RM', value: c.rm?.full_name || '—' },
                    { label: 'KAM', value: c.kam?.full_name || 'Unassigned' },
                    { label: 'Customer', value: c.customer?.legal_name || '—' },
                    { label: 'Contractor', value: c.contractor?.legal_name || '—' },
                  ].map(d => (
                    <div key={d.label} className="space-y-1.5">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{d.label}</p>
                      <p className="font-semibold text-foreground text-base">{d.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {cycle && (
              <Card className="col-span-1 lg:col-span-2 rounded-2xl border-primary/20 bg-primary/5 shadow-sm">
                <CardHeader className="pb-4 border-b border-primary/10">
                  <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                    Review Cycle <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 rounded-md px-2 py-0.5">#{cycle.cycle_number}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { label: 'Current Stage', value: `Stage ${cycle.active_stage}` },
                      { label: 'Case Score', value: cycle.current_case_score ?? liveScore ?? '—' },
                      { label: 'Approved Days', value: cycle.approved_credit_days ? `${cycle.approved_credit_days}d` : '—' },
                      { label: 'Status', value: cycle.is_ambiguous ? 'Ambiguous ⚠' : 'Normal' },
                    ].map(d => (
                      <div key={d.label} className="space-y-1.5">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{d.label}</p>
                        <p className={`font-semibold text-lg ${d.label === 'Status' && cycle.is_ambiguous ? 'text-warning' : 'text-foreground'}`}>{d.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="col-span-1 lg:col-span-2 rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="pb-4 border-b border-border/30">
                <CardTitle className="text-lg font-bold tracking-tight">Party History & Exposure</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
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
                      <p className="text-[10px] text-muted-foreground pt-1">Data as of: {new Date(c.customer_exposure.data_as_of).toLocaleDateString()}</p>
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
                        <p className="text-[10px] text-muted-foreground pt-1">Data as of: {new Date(c.contractor_exposure.data_as_of).toLocaleDateString()}</p>
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
        <TabsContent value="stages" className="focus:outline-none focus-visible:ring-0">
          {!cycle ? (
            <Card className="rounded-2xl border-border/50 shadow-sm"><CardContent className="py-16 text-center text-muted-foreground font-medium">No active review cycle.</CardContent></Card>
          ) : (
            <div className="space-y-6">
              {[1, 2, 3].map(stage => {
                const st = stageTasks(stage);
                const isCurrent = cycle.active_stage === stage;
                const isPast = cycle.active_stage > stage;
                const sc = stageScore(stage);
                return (
                  <Card key={stage} className={cn("rounded-2xl transition-all duration-300", isCurrent ? "border-primary/60 shadow-md" : "border-border/50 shadow-sm opacity-80 hover:opacity-100")}>
                    <CardHeader className={cn("pb-4 border-b border-border/30", isCurrent && "bg-primary/5")}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", isPast ? "bg-success/20 text-success" : isCurrent ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground")}>
                            {isPast
                              ? <CheckCircle size={20} />
                              : isCurrent
                                ? <Clock size={20} />
                                : <AlertCircle size={20} />
                            }
                          </div>
                          <div>
                            <CardTitle className="text-lg font-bold tracking-tight">Stage {stage}</CardTitle>
                            <span className="text-sm font-medium text-muted-foreground">{st.filter((t: any) => t.status === 'Completed').length}/{st.length} tasks completed</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {sc != null && (
                            <Badge variant="info" className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-bold shadow-sm">
                              <Award size={14} /> Score: {sc}
                            </Badge>
                          )}
                          {isCurrent && stageComplete(stage) && cycle.active_stage < 3 && (
                            <form action={handleProgressStage}>
                              <input type="hidden" name="cycleId" value={cycle.id} />
                              <input type="hidden" name="currentStage" value={stage} />
                              <input type="hidden" name="caseId" value={c.id} />
                              <Button type="submit" size="sm" className="h-9 px-4 rounded-lg font-bold shadow-sm transition-all hover:scale-[1.02]">Progress to Stage {stage + 1}</Button>
                            </form>
                          )}
                          {isCurrent && stageComplete(stage) && (
                            <form action={handleCreateApprovalRound}>
                              <input type="hidden" name="cycleId" value={cycle.id} />
                              <input type="hidden" name="stage" value={stage} />
                              <input type="hidden" name="caseId" value={c.id} />
                              <Button type="submit" size="sm" variant="outline" className="h-9 px-4 rounded-lg font-bold shadow-sm transition-all hover:scale-[1.02] border-primary/30 text-primary hover:bg-primary/10">Request Approval</Button>
                            </form>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {st.length > 0 && (
                      <CardContent className="p-0">
                        <div className="divide-y divide-border/50">
                          {st.map((task: any) => (
                            <div key={task.id} className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 hover:bg-muted/10 transition-colors">
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <Badge variant={task.status === 'Completed' ? 'success' : 'secondary'} className="text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                    {task.status}
                                  </Badge>
                                  {task.task_type === 'scoring' && <Badge variant="info" className="text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-primary/10 text-primary border-transparent">Scoring</Badge>}
                                  {task.is_waiting && <Badge variant="warning" className="text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">⏸ Waiting</Badge>}
                                </div>
                                <p className="text-base font-medium text-foreground">{task.description}</p>
                                <div className="text-xs font-medium text-muted-foreground flex flex-wrap items-center gap-3">
                                  {task.status !== 'Completed' && (activeRole === 'founder_admin' || activeRole === 'kam') ? (
                                    <form action={handleAssignTask} className="flex items-center gap-2">
                                      <input type="hidden" name="taskId" value={task.id} />
                                      <input type="hidden" name="caseId" value={c.id} />
                                      <select
                                        name="assigneeId"
                                        defaultValue={task.assigned_to || ""}
                                        onChange={(e) => e.target.form?.requestSubmit()}
                                        className="h-8 text-xs bg-muted/40 border border-border/50 rounded-lg px-2 font-medium outline-none focus:ring-1 focus:ring-primary"
                                      >
                                        <option value="">Unassigned</option>
                                        {data.users?.map((u: any) => (
                                          <option key={u.id} value={u.id}>{u.full_name}</option>
                                        ))}
                                      </select>
                                    </form>
                                  ) : (
                                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/30"></span> {task.assigned?.full_name || 'Unassigned'}</span>
                                  )}
                                  {task.grade_value != null && <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md">Grade: {task.grade_value}</span>}
                                  {task.reason && <span className="opacity-80 italic">· {task.reason}</span>}
                                </div>
                              </div>
                              {task.status === 'Pending' && isCurrent && (activeRole === 'founder_admin' || !task.param?.default_owning_role || task.param.default_owning_role === activeRole) && (
                                <form action={handleCompleteTask} className="flex flex-wrap lg:flex-nowrap items-center gap-3 shrink-0 bg-muted/20 p-2.5 rounded-xl border border-border/40">
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <input type="hidden" name="caseId" value={c.id} />
                                  {task.task_type === 'scoring' && (
                                    <>
                                      {task.param?.input_type === 'grade_select' || task.param?.input_type === 'yes_no' ? (
                                        <select
                                          name="gradeValue"
                                          className="flex h-9 w-28 rounded-lg border border-border/50 bg-background px-3 py-1 text-sm shadow-sm outline-none focus:ring-1 focus:ring-primary font-medium"
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
                                          className="flex h-9 w-32 rounded-lg border border-border/50 bg-background px-3 py-1 text-sm shadow-sm outline-none focus:ring-1 focus:ring-primary font-medium"
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
                                          className="w-28 h-9 text-sm rounded-lg"
                                        />
                                      )}
                                      <Input name="reason" placeholder="Reason" className="w-36 h-9 text-sm rounded-lg" />
                                    </>
                                  )}
                                  <Button type="submit" size="sm" className="h-9 px-4 rounded-lg font-bold shadow-sm">Complete</Button>
                                </form>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                    {st.length === 0 && (
                      <CardContent className="py-8 text-center">
                        <p className="text-sm font-medium text-muted-foreground opacity-60">No tasks configured for this stage.</p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="focus:outline-none focus-visible:ring-0">
          {data.approvalRounds.length === 0 ? (
            <Card className="rounded-2xl border-border/50 shadow-sm"><CardContent className="py-16 text-center text-muted-foreground font-medium">No approval rounds yet. Complete all tasks for a stage and click "Request Approval".</CardContent></Card>
          ) : (
            <div className="space-y-6">
              {data.approvalRounds.map((round: any) => (
                <Card key={round.id} className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <CardHeader className="pb-4 bg-muted/10 border-b border-border/30">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold tracking-tight">Round #{round.round_number || 1} — Stage {round.stage}</CardTitle>
                      <Badge variant={round.status === 'approved' ? 'success' : round.status === 'rejected' ? 'destructive' : round.status === 'open' ? 'warning' : 'secondary'} className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm">
                        {round.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {round.decisions?.map((d: any) => (
                      <div key={d.id} className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                          <span className="text-primary font-bold text-sm">{(d.approver?.full_name || 'U')[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-base font-bold text-foreground">{d.approver?.full_name || 'Unknown'}</span>
                            <Badge variant={d.decision === 'approve' ? 'success' : d.decision === 'reject' ? 'destructive' : 'warning'} className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                              {d.decision?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          {d.comment && <p className="text-sm font-medium text-muted-foreground bg-background/50 p-3 rounded-lg border border-border/30 mt-2">{d.comment}</p>}
                        </div>
                      </div>
                    ))}
                    {round.status === 'open' && (
                      <div className="mt-6 pt-6 border-t border-border/40">
                        <form action={handleApprovalDecision} className="space-y-4">
                          <input type="hidden" name="roundId" value={round.id} />
                          <input type="hidden" name="caseId" value={c.id} />
                          <Textarea name="comment" placeholder="Add a comment to your decision (optional)" className="min-h-[100px] resize-none rounded-xl bg-muted/20 focus:bg-background" />
                          <div className="flex flex-wrap gap-3">
                            <Button type="submit" name="decision" value="approve" className="h-11 px-6 rounded-xl font-bold bg-success hover:bg-success/90 text-success-foreground shadow-sm">Approve</Button>
                            <Button type="submit" name="decision" value="reject" variant="outline" className="h-11 px-6 rounded-xl font-bold border-destructive/50 text-destructive hover:bg-destructive/10">Reject</Button>
                            <Button type="submit" name="decision" value="return_for_revision" variant="outline" className="h-11 px-6 rounded-xl font-bold">Return for Revision</Button>
                          </div>
                        </form>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Ledger & Billing Tab */}
        <TabsContent value="ledger" className="focus:outline-none focus-visible:ring-0">
          {data.ledger ? (
            <LedgerTab
              caseId={c.id}
              activeRole={activeRole}
              ledger={data.ledger}
            />
          ) : (
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardContent className="py-20 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-2">
                  <Wallet size={32} className="text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Ledger Unavailable</h3>
                <p className="text-muted-foreground font-medium max-w-sm">Ledger data is unavailable. The case must be Approved or in a billing state.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="focus:outline-none focus-visible:ring-0">
          <div className="space-y-6 max-w-4xl mx-auto">
            <Card className="print:hidden rounded-2xl border-border/50 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <form action={handleAddComment} className="flex flex-col">
                  <input type="hidden" name="caseId" value={c.id} />
                  <Textarea name="content" placeholder="Type your comment here..." className="min-h-[120px] resize-none border-0 focus-visible:ring-0 px-6 py-5 bg-background rounded-none text-base" required />
                  <div className="bg-muted/30 px-6 py-4 flex justify-end border-t border-border/40">
                    <Button type="submit" size="sm" className="h-10 px-6 rounded-xl font-bold shadow-sm">Post Comment</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {data.comments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground font-medium opacity-60">No comments yet. Be the first to start the discussion.</div>
            ) : (
              <div className="space-y-6 pt-4">
                {data.comments.map((cm: any) => (
                  <div key={cm.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 mt-1">
                      <span className="text-primary font-bold text-sm">{(cm.author?.full_name || 'U')[0].toUpperCase()}</span>
                    </div>
                    <Card className="flex-1 rounded-2xl rounded-tl-none border-border/40 shadow-sm bg-muted/10 hover:bg-muted/20 transition-colors">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3 border-b border-border/30 pb-2">
                          <span className="text-sm font-bold text-foreground">{cm.author?.full_name || 'Unknown'}</span>
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{new Date(cm.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-foreground/90 whitespace-pre-wrap">{cm.body}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="focus:outline-none focus-visible:ring-0">
          {data.auditEvents.length === 0 ? (
            <Card className="rounded-2xl border-border/50 shadow-sm"><CardContent className="py-16 text-center text-muted-foreground font-medium">No audit events yet.</CardContent></Card>
          ) : (
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardContent className="p-8">
                <div className="relative pl-8 space-y-0">
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border/60 rounded-full" />
                  {data.auditEvents.map((e: any, idx: number) => (
                    <div key={e.id} className={`relative pb-8 ${idx === data.auditEvents.length - 1 ? 'pb-0' : ''}`}>
                      <div className="absolute -left-[26px] top-1.5 w-3 h-3 rounded-full bg-primary ring-4 ring-background border border-primary/20" />
                      <div className="bg-muted/20 p-4 rounded-xl border border-border/30 inline-block w-full">
                        <p className="text-sm font-bold text-foreground leading-snug mb-1.5">{e.description}</p>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          <span className="text-foreground/70">{e.actor?.full_name || 'System'}</span> <span className="mx-1 opacity-50">·</span> {new Date(e.created_at).toLocaleString()}
                        </p>
                        {e.field_diffs && (
                          <div className="mt-3 overflow-hidden rounded-lg border border-border/40">
                            <div className="bg-muted px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40">Data Payload</div>
                            <pre className="text-xs bg-background p-3 overflow-x-auto text-muted-foreground font-mono leading-relaxed">{JSON.stringify(e.field_diffs, null, 2)}</pre>
                          </div>
                        )}
                      </div>
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
