import {
  FileEdit, RefreshCw, PauseCircle, Hourglass, Scale, CheckCircle2,
  BadgeCheck, Wallet, AlertTriangle, XCircle, Ban, Undo2, TimerOff, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusMeta, type SemanticFamily } from '@/lib/vocabulary';

/**
 * Status badge — text + icon + semantic colour (doctrine §13.1).
 * Colour is reinforcement only: every badge carries an icon and plain-language
 * text, and can show the one-line meaning via `title` / optional `showMeaning`.
 */

const FAMILY_CLASSES: Record<SemanticFamily, string> = {
  neutral: 'bg-secondary text-secondary-foreground border-border',
  active: 'bg-info/15 text-info border-info/25',
  waiting: 'bg-warning/15 text-warning border-warning/25',
  positive: 'bg-success/15 text-success border-success/25',
  negative: 'bg-destructive/15 text-destructive border-destructive/25',
  exception: 'bg-attention/15 text-attention border-attention/25',
};

const STATUS_ICONS: Record<string, any> = {
  'Draft': FileEdit,
  'In Review': RefreshCw,
  'Awaiting Input': PauseCircle,
  'Awaiting Approval': Hourglass,
  'Appealed': Scale,
  'Approved': CheckCircle2,
  'Accepted': BadgeCheck,
  'Billing Active': Wallet,
  'Pending Write-Off Approval': AlertTriangle,
  'Closed': CheckCircle2,
  'Rejected': XCircle,
  'Cancelled': Ban,
  'Withdrawn': Undo2,
  'Expired': TimerOff,
};

export function StatusBadge({
  status,
  substatus,
  showMeaning = false,
  size = 'sm',
  className,
}: {
  status: string;
  substatus?: string | null;
  showMeaning?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = getStatusMeta(status);
  const Icon = STATUS_ICONS[status] || HelpCircle;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        title={meta.meaning}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-semibold',
          FAMILY_CLASSES[meta.family],
          size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        )}
      >
        <Icon size={size === 'sm' ? 12 : 14} aria-hidden="true" />
        <span>{meta.label}</span>
        {substatus && <span className="opacity-70 font-normal">· {substatus}</span>}
      </span>
      {showMeaning && <span className="text-xs text-muted-foreground">{meta.meaning}</span>}
    </span>
  );
}
