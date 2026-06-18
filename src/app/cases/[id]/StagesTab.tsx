/* eslint-disable */
"use client";
import { use, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, AlertCircle, Award } from 'lucide-react';
import { handleProgressStage, handleCreateApprovalRound, handleAssignTask } from './actions';
import TaskCompleteForm from './TaskCompleteForm';
import { cn } from '@/lib/utils';
import { SubmitButton } from '@/components/ui/submit-button';


const STATUS_VARIANT: Record<string, any> = {
  'Draft': 'secondary', 'In Review': 'warning', 'Awaiting Approval': 'warning',
  'Approved': 'success', 'Rejected': 'destructive', 'Withdrawn': 'secondary',
  'Completed': 'secondary', 'In Progress': 'info', 'Pending': 'outline',
};

const isTaskOverdue = (task: any) => {
  if (!task.sla_deadline || task.status === 'Completed') return false;
  return new Date(task.sla_deadline) < new Date();
};

export default function StagesTab({ coreData, tasksData, activeRole, optimisticTasks, addOptimisticTask, stageScore }: any) {
  const c = coreData.case;
  const cycle = coreData.cycle;

  const { stageSummaries, users, rcaReasons, delayReasons } = tasksData;
  const data = { users, rcaReasons, delayReasons, stageSummaries };

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

  return (
    <div className="space-y-4 mt-6">
          {!cycle ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No active review cycle.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3].map(stage => {
                const st = stageTasks(stage);
                const isCurrent = cycle.active_stage === stage;
                const isPast = cycle.active_stage > stage;
                const sc = stageScore(stage);
                const summary = data.stageSummaries?.find((s: any) => s.stage === stage);

                const displayScore = summary?.score ?? sc;
                const displayStatus = summary?.status || (isPast ? 'Completed' : isCurrent ? 'In Progress' : 'Pending');
                const bandName = summary?.bandName;
                const approvedDays = summary?.approvedDays;

                return (
                  <Card key={stage} className={cn(isCurrent && "border-primary/60")}>
                    <CardHeader className="pb-3 text-card-foreground">
                      <div className="flex items-center gap-3">
                        {isPast
                          ? <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                          : isCurrent
                            ? <Clock size={18} className="text-amber-400 shrink-0" />
                            : <AlertCircle size={18} className="text-muted-foreground shrink-0" />
                        }
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">Stage {stage}</CardTitle>
                            <Badge variant={STATUS_VARIANT[displayStatus] || 'secondary'} className="text-tiny h-4 px-1.5 uppercase font-bold tracking-wider">
                              {displayStatus}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {st.filter((t: any) => t.status === 'Completed').length}/{st.length} tasks completed  // eslint-disable-line @typescript-eslint/no-explicit-any
                          </p>
                        </div>

                        {displayScore != null && (
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="flex items-center gap-1 border-primary/30 text-primary bg-primary/5">
                              <Award size={12} /> Score: {displayScore}/100
                            </Badge>
                            {bandName && bandName !== 'No Band' && (
                              <span className="text-tiny font-medium text-muted-foreground">
                                {bandName} ({approvedDays} days)
                              </span>
                            )}
                          </div>
                        )}
                        {isCurrent && stageComplete(stage) && cycle.active_stage < 3 && (
                          <form action={handleProgressStage}>
                            <input type="hidden" name="cycleId" value={cycle.id} />
                            <input type="hidden" name="currentStage" value={stage} />
                            <input type="hidden" name="caseId" value={c.id} />
                            <SubmitButton type="submit" size="sm">Progress to Stage {stage + 1}</SubmitButton>
                          </form>
                        )}
                        {isCurrent && stageComplete(stage) && (
                          <form action={handleCreateApprovalRound}>
                            <input type="hidden" name="cycleId" value={cycle.id} />
                            <input type="hidden" name="stage" value={stage} />
                            <input type="hidden" name="caseId" value={c.id} />
                            <SubmitButton type="submit" size="sm" variant="outline">Request Approval</SubmitButton>
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
                                      {task.sla_deadline && task.status !== 'Completed' && (() => {
                                        const isOverdue = isTaskOverdue(task);
                                        const diffDays = Math.ceil((new Date(task.sla_deadline).getTime() - new Date().getTime()) / 86400000);
                                        return (
                                          <Badge variant={isOverdue ? 'destructive' : 'warning'} className="text-xs">
                                            {isOverdue ? `⚠ Overdue by ${Math.abs(diffDays)}d` : `SLA: ${diffDays}d left`}
                                          </Badge>
                                        );
                                      })()}
                                    </div>
                                    <p className="text-sm">{task.description}</p>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                  {task.status !== 'Completed' && (activeRole === 'founder_admin' || activeRole === 'kam') ? (
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
                                                <select
                                                  name="assigneeId"
                                                  defaultValue={task.assigned_to || ""}
                                                  className="h-6 text-xs bg-background border border-input rounded px-1"
                                                >
                                                  <option value="">Unassigned</option>
                                                  {filtered.map((u: any) => (
                                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                                  ))}
                                                </select>
                                                <SubmitButton type="submit" size="sm" variant="ghost" className="h-6 text-xs px-1">Assign</SubmitButton>
                                              </form>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  ) : (
                                    <span>{task.assigned?.full_name || 'Unassigned'}</span>
                                  )}
                                  {task.grade_value != null && <span>· Grade: {task.grade_value}</span>}
                                  {task.reason && <span>· {task.reason}</span>}
                                </div>
                              </div>
                                  {task.status === 'Pending' && isCurrent && (activeRole === 'founder_admin' || !task.param?.default_owning_role || task.param.default_owning_role === activeRole) && (
                                <TaskCompleteForm task={task} c={c} data={data} addOptimisticTask={addOptimisticTask} />
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
    </div>
  );
}
