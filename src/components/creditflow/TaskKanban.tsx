import Link from 'next/link';
import { CircleDashed, Hourglass, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompactINR, relativeDays, daysUntil } from '@/lib/format';

/**
 * My Work task board — every task assigned to me, as a Kanban.
 * Columns mirror the real task lifecycle (tasks move Pending → Completed or
 * Waived, with an explicit "waiting" pause): To do, Waiting on someone, Done.
 * Cards link straight to the case workspace where the task is completed.
 */

export interface KanbanTask {
  id: string;
  description: string;
  status: string;
  stage: number;
  is_waiting: boolean;
  waiting_reason?: string | null;
  sla_deadline?: string | null;
  completed_at?: string | null;
  case: { id: string; case_number: string; bill_amount?: number | null; customer?: { legal_name?: string } | null };
}

function TaskCard({ t, done }: { t: KanbanTask; done?: boolean }) {
  const until = daysUntil(t.sla_deadline);
  const overdue = !done && !t.is_waiting && until !== null && until < 0;
  return (
    <Link
      href={`/cases/${t.case.id}`}
      className={cn(
        'block rounded-lg border bg-card p-3 space-y-1 hover:border-primary/50 transition-colors',
        overdue ? 'border-destructive/40' : 'border-border',
        done && 'opacity-75'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">{t.case.case_number}</span>
        <span className="text-tiny font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Stage {t.stage}</span>
      </div>
      <p className="text-xs text-foreground/90 line-clamp-2">{t.description}</p>
      <p className="text-tiny text-muted-foreground truncate">
        {t.case.customer?.legal_name || 'No party'}
        {t.case.bill_amount != null && <> · {formatCompactINR(t.case.bill_amount)}</>}
      </p>
      {done ? (
        <p className="text-tiny text-muted-foreground">
          {t.status === 'Waived' ? 'Waived' : 'Completed'}{t.completed_at && ` ${relativeDays(t.completed_at)}`}
        </p>
      ) : t.is_waiting ? (
        <p className="text-tiny font-medium text-warning-strong">
          Waiting — SLA paused{t.waiting_reason ? `: ${t.waiting_reason}` : ''}
        </p>
      ) : t.sla_deadline ? (
        <p className={cn('text-tiny font-medium', overdue ? 'text-destructive' : 'text-muted-foreground')}>
          {overdue ? `Overdue ${Math.abs(until!)}d` : until === 0 ? 'Due today' : `Due ${relativeDays(t.sla_deadline)}`}
        </p>
      ) : null}
    </Link>
  );
}

function Column({ title, icon: Icon, tasks, tone, done, emptyText }: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>;
  tasks: KanbanTask[];
  tone?: 'default' | 'warning' | 'success';
  done?: boolean;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-muted/30 min-w-[240px]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <Icon
          size={14}
          className={tone === 'warning' ? 'text-warning-strong' : tone === 'success' ? 'text-success-strong' : 'text-primary'}
          aria-hidden="true"
        />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{title}</h3>
        <span className="text-xs text-muted-foreground ml-auto">{tasks.length}</span>
      </div>
      <div className="p-2 space-y-2 overflow-y-auto max-h-[26rem]">
        {tasks.length === 0
          ? <p className="text-tiny text-muted-foreground px-1.5 py-3">{emptyText}</p>
          : tasks.map((t) => <TaskCard key={t.id} t={t} done={done} />)}
      </div>
    </div>
  );
}

export function TaskKanban({ openTasks, doneTasks }: { openTasks: KanbanTask[]; doneTasks: KanbanTask[] }) {
  const todo = openTasks.filter((t) => !t.is_waiting);
  const waiting = openTasks.filter((t) => t.is_waiting);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
      <Column title="To do" icon={CircleDashed} tasks={todo} emptyText="Nothing waiting on you." />
      <Column title="Waiting on someone" icon={Hourglass} tasks={waiting} tone="warning" emptyText="No paused tasks." />
      <Column title="Done · last 14 days" icon={CheckCircle2} tasks={doneTasks} tone="success" done emptyText="Nothing completed in the last 14 days." />
    </div>
  );
}
