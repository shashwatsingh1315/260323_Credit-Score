"use client";
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { handleCompleteTask } from './actions';

const isTaskOverdue = (task: any) => {
  if (!task.sla_deadline || task.status === 'Completed') return false;
  return new Date(task.sla_deadline) < new Date();
};

export default function TaskCompleteForm({ task, c, data, addOptimisticTask }: { task: any, c: any, data: any, addOptimisticTask?: (t: any) => void }) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        if (addOptimisticTask) {
          addOptimisticTask({
            id: task.id,
            status: 'Completed',
            grade_value: fd.get('gradeValue'),
            reason: fd.get('reason') || fd.get('delayReason'),
            raw_input: fd.get('rawInput')
          });
        }
        startTransition(async () => {
          await handleCompleteTask(fd);
        });
      }}
      className="flex items-center gap-2 shrink-0"
    >
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
                Array.from({ length: 5 }, (_, i) => (
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
          {task.param?.require_reasoning ? (
            <div className="flex flex-col gap-1 w-32 shrink-0">
              <select name="reason" className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-sm" required>
                <option value="">-- Reason *</option>
                {data.rcaReasons?.map((r: any) => (
                  <option key={r.value} value={r.value}>{r.value}</option>
                ))}
              </select>
            </div>
          ) : (
            <Input name="reason" placeholder="Reason (optional)" className="w-28 h-8 text-xs shrink-0" />
          )}
        </>
      )}

      {isTaskOverdue(task) && (
        <div className="flex flex-col gap-1 shrink-0">
          <Badge variant="destructive" className="text-[10px] uppercase py-0 leading-3">SLA Breached</Badge>
          <select name="delayReason" className="flex h-8 w-32 rounded-md border border-destructive bg-destructive/10 text-destructive px-2 text-xs shadow-sm" required>
            <option value="">Delay reason *</option>
            {data.delayReasons?.map((r: any) => (
              <option key={r.value} value={r.value}>{r.value}</option>
            ))}
          </select>
        </div>
      )}

      <Button type="submit" size="sm" className="shrink-0" disabled={isPending}>
        {isPending ? 'Saving...' : 'Complete'}
      </Button>
    </form>
  );
}
