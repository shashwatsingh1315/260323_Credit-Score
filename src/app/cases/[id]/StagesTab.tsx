"use client";
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, AlertCircle, Award, ChevronDown, PauseCircle, Send } from 'lucide-react';
import { handleSubmitStage, handleCreateApprovalRound, handleAssignTask } from './actions';
import TaskCompleteForm from './TaskCompleteForm';
import { cn } from '@/lib/utils';
import { SubmitButton } from '@/components/ui/submit-button';
import { formatDateIST, daysUntil } from '@/lib/format';

/**
 * Work tab — doctrine §12.5.
 * The current stage gets the strongest emphasis; completed stages summarize;
 * future stages collapse to a preview. One canonical CTA — "Submit Stage" —
 * lets the system decide the next valid transition (Principle 3).
 */

const isTaskOverdue = (task: any) => {
  if (!task.sla_deadline || task.status === 'Completed') return false;
  return new Date(task.sla_deadline) < new Date();
};

export default function StagesTab({ coreData, tasksData, activeRole, optimisticTasks, addOptimisticTask, stageScore }: any) {
  const c = coreData.case;
  const cycle = coreData.cycle;

  const { stageSummaries, users, rcaReasons, delayReasons, gradeScale } = tasksData;
  const data = { users, rcaReasons, delayReasons, stageSummaries, gradeScale };

  // Collapse state for non-current stages (future/past preview).
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const tasksByStage = useMemo(() => {
    const grouped: Record<number, any[]> = { 1: [], 2: [], 3: [] };
    optimisticTasks.forEach((t: any) => {
      if (grouped[t.stage]) {
        grouped[t.stage].push(t);
      }
    });
    return grouped;
  }, [optimisticTasks]);

  const stageTasks = (s: number) => tasksByStage[s] || [];
  const stageComplete = (s: number) => {
    const st = stageTasks(s);
    if (!st.length) return true;
    return st.filter((t: any) => t.is_required).every((t: any) => t.status === 'Completed' || t.is_waived);
  };

  if (!cycle) {
    return (
      <Card className="mt-4">
        <CardContent className="py-10 text-center text-muted-foreground text-sm space-y-1">
          <p className="font-medium text-foreground">No review in progress</p>
          <p>This case has no active review cycle. Submitting the case for review creates Stage 1 tasks.</p>
        </CardContent>
      </Card>
    );
  }

  const canSubmit = activeRole === 'kam' || activeRole === 'founder_admin';
  const requiredStage = cycle.required_stage ?? 3;

  return (
    <div className="space-y-4 mt-4">
      {[1, 2, 3].map(stage => {
        const st = stageTasks(stage);
        const isCurrent = cycle.active_stage === stage;
        const isPast = cycle.active_stage > stage;
        const isNotRequired = stage > requiredStage;
        const sc = stageScore(stage);
        const summary = data.stageSummaries?.find((s: any) => s.stage === stage);

        const displayScore = summary?.score ?? sc;
        const bandName = summary?.bandName;
        const recommendedDays = summary?.approvedDays;
        const completedCount = st.filter((t: any) => t.status === 'Completed').length;
        const requiredIncomplete = st.filter((t: any) => t.is_required && t.status !== 'Completed' && !t.is_waived).length;
        const waitingTasks = st.filter((t: any) => t.is_waiting && t.status !== 'Completed');
        const isExpanded = isCurrent || expanded[stage];
        const complete = stageComplete(stage);

        const stageState = isNotRequired ? 'Not required for this case' : isPast ? 'Completed' : isCurrent ? (summary?.status || 'In Progress') : 'Upcoming';

        return (
          <Card key={stage} className={cn(isCurrent && 'border-primary/50 shadow-sm')}>
            <CardHeader className={cn('pb-3', !isExpanded && 'py-3')}>
              <div className="flex items-center gap-3 flex-wrap">
                {isPast
                  ? <CheckCircle size={18} className="text-success shrink-0" aria-hidden="true" />
                  : isCurrent
                    ? <Clock size={18} className="text-warning shrink-0" aria-hidden="true" />
                    : <AlertCircle size={18} className="text-muted-foreground/50 shrink-0" aria-hidden="true" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">
                      Stage {stage}
                      {isCurrent && <span className="ml-2 text-tiny font-bold uppercase tracking-wider text-primary">Current</span>}
                    </CardTitle>
                    <Badge
                      variant={isPast ? 'success' : isCurrent ? 'info' : 'secondary'}
                      className="text-tiny h-4 px-1.5 uppercase font-bold tracking-wider"
                    >
                      {stageState}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isNotRequired ? 'Policy routing stops before this stage.' : <>{completedCount} of {st.length} tasks complete</>}
                    {isCurrent && requiredIncomplete > 0 && ` · ${requiredIncomplete} required remaining`}
                    {isCurrent && waitingTasks.length > 0 && (
                      <span className="text-warning"> · waiting on {waitingTasks.length} item{waitingTasks.length !== 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>

                {displayScore != null && (
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="flex items-center gap-1 border-primary/30 text-primary bg-primary/5" title="Policy score (0–100, higher is safer)">
                      <Award size={12} aria-hidden="true" /> {displayScore}/100
                    </Badge>
                    {bandName && bandName !== 'No Band' && (
                      <span className="text-tiny font-medium text-muted-foreground">
                        {bandName} · policy recommends {recommendedDays}d
                      </span>
                    )}
                  </div>
                )}

                {/* One canonical CTA: Submit Stage — system decides the transition */}
                {isCurrent && complete && canSubmit && (
                  <form action={handleSubmitStage}>
                    <input type="hidden" name="cycleId" value={cycle.id} />
                    <input type="hidden" name="currentStage" value={stage} />
                    <input type="hidden" name="caseId" value={c.id} />
                    <SubmitButton type="submit" size="sm">
                      <Send size={13} className="mr-1.5" aria-hidden="true" />
                      {stage < requiredStage ? `Submit Stage ${stage}` : 'Submit for approval'}
                    </SubmitButton>
                  </form>
                )}
                {isCurrent && complete && !canSubmit && (
                  <p className="text-xs text-muted-foreground">All required tasks complete — the KAM submits this stage.</p>
                )}
                {/* Early approval is an exception path, visually secondary */}
                {isCurrent && complete && stage < requiredStage && canSubmit && (
                  <form action={handleCreateApprovalRound}>
                    <input type="hidden" name="cycleId" value={cycle.id} />
                    <input type="hidden" name="stage" value={stage} />
                    <input type="hidden" name="caseId" value={c.id} />
                    <SubmitButton type="submit" size="sm" variant="ghost" className="text-xs text-muted-foreground" title="Exception: request an approval decision before Stage 3">
                      Request early approval
                    </SubmitButton>
                  </form>
                )}

                {!isCurrent && st.length > 0 && !isNotRequired && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(prev => ({ ...prev, [stage]: !prev[stage] }))}
                    aria-expanded={!!isExpanded}
                    aria-label={isExpanded ? `Collapse Stage ${stage} tasks` : `Preview Stage ${stage} tasks`}
                    className="text-xs"
                  >
                    <ChevronDown size={14} className={cn('mr-1 transition-transform', isExpanded && 'rotate-180')} aria-hidden="true" />
                    {isExpanded ? 'Collapse' : isPast ? 'Review' : 'Preview'}
                  </Button>
                )}
              </div>
            </CardHeader>

            {isExpanded && st.length > 0 && !isNotRequired && (
              <CardContent className="pt-0">
                <div className="divide-y divide-border">
                  {st.map((task: any) => (
                    <div key={task.id} className="py-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={task.status === 'Completed' ? 'success' : 'secondary'} className="text-xs">
                              {task.status === 'Completed' ? 'Done' : task.status}
                            </Badge>
                            {task.is_required && task.status !== 'Completed' && (
                              <span className="text-tiny font-semibold text-muted-foreground uppercase tracking-wide">Required</span>
                            )}
                            {task.task_type === 'scoring' && <Badge variant="info" className="text-xs">Scoring</Badge>}
                            {task.sla_deadline && task.status !== 'Completed' && !task.is_waiting && (() => {
                              const overdue = isTaskOverdue(task);
                              const diffDays = daysUntil(task.sla_deadline) ?? 0;
                              return (
                                <Badge variant={overdue ? 'destructive' : 'warning'} className="text-xs">
                                  {overdue ? `Overdue ${Math.abs(diffDays)}d` : diffDays === 0 ? 'Due today' : `Due in ${diffDays}d`}
                                </Badge>
                              );
                            })()}
                          </div>
                          <p className="text-sm">{task.description}</p>

                          {/* Waiting is a modeled state with a visible reason (Principle 9) */}
                          {task.is_waiting && task.status !== 'Completed' && (
                            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-warning bg-warning/10 border border-warning/25 rounded px-2 py-1">
                              <PauseCircle size={12} aria-hidden="true" />
                              Waiting{task.waiting_reason ? `: ${task.waiting_reason}` : ' on external input'} — SLA paused
                            </p>
                          )}

                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1.5 flex-wrap">
                            {task.status !== 'Completed' && canSubmit ? (
                              <div className="flex items-center gap-1">
                                {(() => {
                                  const requiredRole = task.param?.default_owning_role;
                                  const filtered = data.users?.filter((u: any) =>
                                    !requiredRole ||
                                    u.roles?.some((r: any) => r.role === requiredRole) ||
                                    u.roles?.some((r: any) => r.role === 'founder_admin')
                                  ) ?? [];
                                  const showWarning = requiredRole && filtered.length === 0;
                                  return (
                                    <>
                                      {showWarning ? (
                                        <span className="text-xs text-destructive">No {requiredRole} users found</span>
                                      ) : (
                                        <form action={handleAssignTask} className="flex items-center gap-1">
                                          <input type="hidden" name="taskId" value={task.id} />
                                          <input type="hidden" name="caseId" value={c.id} />
                                          <label htmlFor={`assign-${task.id}`} className="sr-only">Assign task owner</label>
                                          <select
                                            id={`assign-${task.id}`}
                                            name="assigneeId"
                                            defaultValue={task.assigned_to || ""}
                                            className="h-7 text-xs bg-background border border-input rounded px-1.5"
                                          >
                                            <option value="">Unassigned</option>
                                            {filtered.map((u: any) => (
                                              <option key={u.id} value={u.id}>{u.full_name}</option>
                                            ))}
                                          </select>
                                          <SubmitButton type="submit" size="sm" variant="ghost" className="h-7 text-xs px-1.5">Assign</SubmitButton>
                                        </form>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span>Owner: {task.assigned?.full_name || 'Unassigned'}</span>
                            )}
                            {task.grade_value != null && <span>· Grade: {task.grade_value}</span>}
                            {task.reason && <span>· {task.reason}</span>}
                            {task.completed_at && <span>· done {formatDateIST(task.completed_at)}</span>}
                          </div>
                        </div>
                      </div>
                      {['Pending', 'Completed'].includes(task.status) && isCurrent && (activeRole === 'founder_admin' || activeRole === 'kam' || !task.param?.default_owning_role || task.param.default_owning_role === activeRole) && (
                        <TaskCompleteForm task={task} c={c} data={data} addOptimisticTask={addOptimisticTask} />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
            {isExpanded && st.length === 0 && !isNotRequired && (
              <CardContent className="pt-0 pb-4">
                <p className="text-sm text-muted-foreground italic">No tasks configured for this stage.</p>
              </CardContent>
            )}
          </Card>
        );
      })}
      <p className="rounded-md border border-info/25 bg-info/10 px-3 py-2 text-sm text-info-strong">
        This case must complete Stage {requiredStage} before approval, based on the policy routing rules captured at submission.
      </p>
    </div>
  );
}
