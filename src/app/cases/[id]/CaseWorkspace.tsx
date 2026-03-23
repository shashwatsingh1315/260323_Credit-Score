"use client";
import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight, Clock, CheckCircle, AlertCircle,
  Layers, FileText, History, Shield, MessageSquare,
  BarChart3, TrendingUp, Award, Printer, Scale
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  handleProgressStage, handleCompleteTask, handleWithdraw,
  handleCreateApprovalRound, handleApprovalDecision, handleAddComment
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

  const stageTasks = (s: number) => tasks.filter((t: any) => t.stage === s);
  const stageComplete = (s: number) => {
    const st = stageTasks(s);
    if (!st.length) return false;
    return st.filter((t: any) => t.is_required).every((t: any) => t.status === 'Completed' || t.is_waived);
  };

  // Live scoring: derive from completed scoring tasks
  const stageScore = (stage: number) => {
    const scoringTasks = stageTasks(stage).filter((t: any) => t.task_type === 'scoring' && t.status === 'Completed' && t.grade_value != null);
    if (!scoringTasks.length) return null;
    const totalWeight = scoringTasks.reduce((sum: number, t: any) => sum + (t.weight || 1), 0);
    const weightedSum = scoringTasks.reduce((sum: number, t: any) => sum + (t.grade_value * (t.weight || 1)), 0);
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) : null;
  };

  const allStageScores = [1, 2, 3].map(s => stageScore(s)).filter(v => v != null) as number[];
  const liveScore = allStageScores.length ? Math.round(allStageScores.reduce((a, b) => a + b, 0) / allStageScores.length) : null;

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
            <form action={handleWithdraw} className="print:hidden">
              <input type="hidden" name="caseId" value={c.id} />
              <input type="hidden" name="reason" value="Withdrawn by user" />
              <input type="hidden" name="note" value="Manual withdrawal" />
              <Button type="submit" variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10">Withdraw</Button>
            </form>
          )}

          {c.status === 'Rejected' && (
            <form action={handleCreateApprovalRound} className="print:hidden">
              <input type="hidden" name="caseId" value={c.id} />
              <input type="hidden" name="cycleId" value={cycle.id} />
              <input type="hidden" name="stage" value="3" />
              <input type="hidden" name="roundType" value="appeal" />
              <Button type="submit" variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
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
          <TabsTrigger value="comments"><MessageSquare size={14} className="mr-2" /> Comments</TabsTrigger>
          <TabsTrigger value="audit"><History size={14} className="mr-2" /> Audit Trail</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
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
                                <p className="text-xs text-muted-foreground">
                                  {task.assigned?.full_name || 'Unassigned'}
                                  {task.grade_value != null && ` · Grade: ${task.grade_value}`}
                                  {task.reason && ` · ${task.reason}`}
                                </p>
                              </div>
                              {task.status === 'Pending' && isCurrent && (
                                <form action={handleCompleteTask} className="flex items-center gap-2 shrink-0">
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <input type="hidden" name="caseId" value={c.id} />
                                  {task.task_type === 'scoring' && (
                                    <>
                                      <Input name="gradeValue" type="number" placeholder="Grade 1-10" className="w-24 h-8 text-xs" min="1" max="10" />
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
                      <p className="text-sm">{cm.content}</p>
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
