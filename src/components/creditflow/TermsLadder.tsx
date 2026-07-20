import { cn } from '@/lib/utils';
import { TERMS_LABELS } from '@/lib/vocabulary';
import { formatCompactINR } from '@/lib/format';

/**
 * Terms ladder (doctrine Principle 4): requested, recommended, approved,
 * accepted and realized truth must never collapse into one mutable value.
 * Each row names its layer, its value, and its provenance.
 */
export interface TermsLayer {
  layer: keyof typeof TERMS_LABELS;
  /** e.g. "45 days", "₹10L exposure · 30/60 split" */
  value: string | null;
  /** e.g. "Submitted by RM · 12 Jul", "Policy v3.2", "Approved by Anil · 18 Jul" */
  provenance?: string | null;
  /** Highlight the layer that currently governs the case. */
  governing?: boolean;
  attention?: boolean;
}

export function TermsLadder({ layers, className }: { layers: TermsLayer[]; className?: string }) {
  const visible = layers.filter((l) => l.value != null);
  if (visible.length === 0) return null;

  return (
    <div className={cn('rounded-lg border border-border overflow-hidden', className)}>
      <div className="px-3 py-2 bg-muted/40 border-b border-border">
        <p className="text-tiny font-semibold uppercase tracking-wider text-muted-foreground">
          Terms — requested vs recommended vs approved
        </p>
      </div>
      <dl className="divide-y divide-border/60">
        {visible.map((l) => (
          <div
            key={l.layer}
            className={cn(
              'flex items-baseline justify-between gap-3 px-3 py-2',
              l.governing && 'bg-primary/5',
              l.attention && 'bg-attention/10'
            )}
          >
            <dt className="text-xs text-muted-foreground shrink-0">
              {TERMS_LABELS[l.layer]}
              {l.governing && (
                <span className="ml-1.5 text-tiny font-semibold text-primary uppercase tracking-wide">current</span>
              )}
            </dt>
            <dd className="text-right min-w-0">
              <span className="text-sm font-semibold text-foreground tabular-nums">{l.value}</span>
              {l.provenance && (
                <span className={cn('block text-tiny truncate', l.attention ? 'text-attention-strong' : 'text-muted-foreground')}>{l.provenance}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Bill → Decided → Promised → Collected → Outstanding reconciliation (doctrine §12.9). */
export function ValueProgression({
  bill,
  decided,
  promised,
  collected,
  outstanding,
  className,
}: {
  bill?: number | null;
  decided?: number | null;
  promised?: number | null;
  collected?: number | null;
  outstanding?: number | null;
  className?: string;
}) {
  const steps = [
    { label: 'Bill', value: bill, title: 'Gross commercial bill value' },
    { label: 'Decided', value: decided, title: 'Final commercial amount — margin baseline' },
    { label: 'Promised', value: promised, title: 'Amount the customer commits to pay' },
    { label: 'Collected', value: collected, title: 'Valid payments received' },
    { label: 'Outstanding', value: outstanding, title: 'Promised minus collected, adjusted by credit notes' },
  ].filter((s) => s.value != null);

  if (steps.length === 0) return null;

  return (
    <div className={cn('flex items-stretch gap-1 overflow-x-auto', className)}>
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1 shrink-0">
          {i > 0 && <span className="text-muted-foreground/60 px-0.5" aria-hidden="true">→</span>}
          <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-center" title={s.title}>
            <p className="text-tiny uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="text-sm font-bold tabular-nums text-foreground">{formatCompactINR(s.value)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
