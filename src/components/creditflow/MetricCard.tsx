import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Calm metric card (doctrine §6 queue-supporting metrics, §16 calm interfaces,
 * §18 "a metric without scope, period, or definition" is an anti-pattern).
 *
 * Every metric states its definition and scope, and links to the exact
 * underlying queue — never to an unfiltered list.
 */
export function MetricCard({
  label,
  value,
  definition,
  scope,
  href,
  hrefLabel = 'View records',
  tone = 'default',
  className,
}: {
  label: string;
  value: string;
  /** One-line definition of what the number means. */
  definition: string;
  /** e.g. "Your portfolio · all time" */
  scope?: string;
  href?: string;
  hrefLabel?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  className?: string;
}) {
  const toneClass = {
    default: 'text-foreground',
    warning: 'text-warning',
    danger: 'text-destructive',
    success: 'text-success',
  }[tone];

  return (
    <Card className={cn('h-full', className)}>
      <CardContent className="p-5 h-full flex flex-col">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn('text-3xl font-bold mt-2 tabular-nums', toneClass)}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{definition}</p>
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          {scope && <p className="text-tiny text-muted-foreground/80">{scope}</p>}
          {href && (
            <Link
              href={href}
              className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline ml-auto"
            >
              {hrefLabel} <ArrowRight size={12} aria-hidden="true" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
