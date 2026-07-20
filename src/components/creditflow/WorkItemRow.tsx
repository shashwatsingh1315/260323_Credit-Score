import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompactINR } from '@/lib/format';

/**
 * Work-item row (doctrine §6: queues answer what needs me, why, when due,
 * and what action to take; §8: context travels with the work).
 */
export function WorkItemRow({
  href,
  title,
  party,
  amount,
  reason,
  owner,
  dueLabel,
  overdue = false,
  actionLabel,
  meta,
}: {
  href: string;
  /** Case number or work identifier. */
  title: string;
  party?: string | null;
  amount?: number | null;
  /** Why this item needs attention. */
  reason: React.ReactNode;
  /** Who currently owns the next step ("Waiting on Accounts · Priya"). */
  owner?: string | null;
  /** e.g. "Due tomorrow", "Overdue 3d" */
  dueLabel?: string | null;
  overdue?: boolean;
  actionLabel?: string;
  meta?: string | null;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 border-b border-border/50 last:border-0 hover:bg-accent/40 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {party && <span className="text-xs text-muted-foreground truncate">· {party}</span>}
          {amount != null && (
            <span className="text-xs font-medium text-foreground tabular-nums">· {formatCompactINR(amount)}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{reason}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {owner && <span className="text-tiny font-medium text-foreground/80">{owner}</span>}
          {dueLabel && (
            <span
              className={cn(
                'text-tiny font-semibold px-1.5 py-0.5 rounded',
                overdue ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'
              )}
            >
              {dueLabel}
            </span>
          )}
          {meta && <span className="text-tiny text-muted-foreground">{meta}</span>}
        </div>
      </div>
      {actionLabel && (
        <span className="hidden sm:inline-flex text-xs font-semibold text-primary shrink-0 group-hover:underline">
          {actionLabel}
        </span>
      )}
      <ChevronRight size={15} className="text-muted-foreground shrink-0" aria-hidden="true" />
    </Link>
  );
}
