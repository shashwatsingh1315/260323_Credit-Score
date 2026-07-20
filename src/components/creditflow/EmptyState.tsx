import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Empty states are distinct from zero / unavailable / failed (doctrine §13.6).
 * Use `kind` to make the distinction explicit.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  actionHref,
  actionLabel,
  kind = 'empty',
}: {
  icon?: any;
  title: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
  kind?: 'empty' | 'zero' | 'unavailable' | 'failed' | 'not-provided';
}) {
  return (
    <Card>
      <CardContent className="py-12 px-6 text-center space-y-3">
        {Icon && <Icon size={36} className="mx-auto text-muted-foreground opacity-30" aria-hidden="true" />}
        <p className="text-sm font-medium text-foreground">{title}</p>
        {body && <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">{body}</p>}
        {kind === 'failed' && (
          <p className="text-tiny text-destructive">Loading failed — try refreshing. Your data was not changed.</p>
        )}
        {actionHref && actionLabel && (
          <Button asChild size="sm" className="mt-2">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
