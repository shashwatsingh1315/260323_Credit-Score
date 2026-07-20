"use client";
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { handleCompleteTask } from './actions';
import { parseRubricGuidance } from '@/lib/format';

const isTaskOverdue = (task: any) => {
  if (!task.sla_deadline || task.status === 'Completed') return false;
  return new Date(task.sla_deadline) < new Date();
};

export default function TaskCompleteForm({ task, c, data, addOptimisticTask }: { task: any, c: any, data: any, addOptimisticTask?: (t: any) => void }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(task.status !== 'Completed');
  const isUpdate = task.status === 'Completed';
  const knownReason = data.rcaReasons?.some((item: any) => item.value === task.reason) ? task.reason : '';
  const configuredTopGrade = Math.max(
    0,
    ...(data.gradeScale || []).map((grade: any) => Number(grade.grade_value) || 0),
  );
  const topGrade = configuredTopGrade || 5;
  const weight = Number(task.param?.weight) || 0;

  if (!editing) {
    return (
      <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(true)}>
        Edit answer
      </Button>
    );
  }

  return (
    <form
      action={(fd) => {
        if (addOptimisticTask) {
          addOptimisticTask({
            id: task.id,
            status: 'Completed',
            grade_value: fd.get('gradeValue'),
            reason: [fd.get('reason'), fd.get('reasonNote')].filter(Boolean).join(' — '),
            raw_input_value: fd.get('rawInput'),
          });
        }
        startTransition(async () => {
          await handleCompleteTask(fd);
          setEditing(false);
        });
      }}
      className="w-full space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="caseId" value={c.id} />

      {task.param?.rubric_guidance && (
        <div className="rounded-md border border-info/25 bg-info/10 p-3 text-xs text-foreground">
          <p className="mb-1 font-semibold text-info-strong">How to judge this evidence</p>
          {parseRubricGuidance(task.param.rubric_guidance).map((line, i) => (
            <span key={i} className="block">
              {line.map((part, j) => part.strong ? <strong key={j}>{part.text}</strong> : <span key={j}>{part.text}</span>)}
            </span>
          ))}
        </div>
      )}

      {task.task_type === 'scoring' && (
        <div className="space-y-3">
          <label className="block space-y-1.5 text-xs font-medium">
            Evidence answer
            {task.param?.input_type === 'grade_select' ? (
              <select name="gradeValue" defaultValue={task.grade_value ?? ''} aria-label={`Grade for: ${task.description}`} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">-- Select --</option>
                {task.param.auto_band_config?.mappings
                  ? task.param.auto_band_config.mappings.map((mapping: any, i: number) => <option key={i} value={mapping.grade}>{mapping.value} (Grade {mapping.grade})</option>)
                  : data.gradeScale?.length > 0
                    ? data.gradeScale.map((grade: any) => <option key={grade.grade_value} value={grade.grade_value}>{grade.grade_value} — {grade.grade_label}</option>)
                    : [5, 4, 3, 2, 1].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
              </select>
            ) : task.param?.input_type === 'dropdown' || task.param?.input_type === 'link_list' || task.param?.input_type === 'yes_no' ? (
              <select name="rawInput" defaultValue={task.raw_input_value ?? ''} aria-label={`Answer for: ${task.description}`} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">-- Select --</option>
                {task.param.input_type === 'yes_no'
                  ? <><option value="Yes">Yes</option><option value="No">No</option></>
                  : task.param.auto_band_config?.mappings?.map((mapping: any, i: number) => <option key={i} value={mapping.value}>{mapping.value}</option>)}
              </select>
            ) : (
              <Input type={task.param?.input_type === 'numeric' ? 'number' : task.param?.input_type === 'date' ? 'date' : 'text'} name="rawInput" defaultValue={task.raw_input_value ?? ''} aria-label={`Answer for: ${task.description}`} />
            )}
          </label>

          <p className="text-xs text-muted-foreground">
            Weight {weight.toLocaleString('en-IN')} — contributes up to {(weight * topGrade).toLocaleString('en-IN')} pts of this stage&apos;s score.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium">
              Reason {task.param?.require_reasoning ? '(required)' : '(optional)'}
              <select name="reason" defaultValue={knownReason} required={!!task.param?.require_reasoning} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">-- Select reason --</option>
                {data.rcaReasons?.map((reason: any) => <option key={reason.value} value={reason.value}>{reason.value}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-medium">
              Note (optional)
              <Input name="reasonNote" defaultValue={knownReason ? '' : task.reason ?? ''} placeholder="Add context for reviewers" />
            </label>
          </div>
        </div>
      )}

      {isTaskOverdue(task) && (
        <div className="space-y-1.5">
          <Badge variant="destructive" className="text-tiny uppercase">SLA breached</Badge>
          <select name="delayReason" aria-label="Delay reason" className="flex h-10 w-full rounded-md border border-destructive bg-destructive/10 px-3 text-sm text-destructive" required>
            <option value="">Delay reason *</option>
            {data.delayReasons?.map((reason: any) => <option key={reason.value} value={reason.value}>{reason.value}</option>)}
          </select>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {isUpdate && <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Saving…' : isUpdate ? 'Update answer' : 'Complete task'}</Button>
      </div>
    </form>
  );
}
