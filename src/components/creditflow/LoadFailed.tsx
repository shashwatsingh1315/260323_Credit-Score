/**
 * A query behind this area failed, so there is nothing trustworthy to show.
 * Render this instead of an empty, zero or "all clear" state: a failed load
 * must never read as "nothing to do" (doctrine §13.6).
 *
 * `what` is a short noun phrase, e.g. "your tasks" → "Couldn't load your tasks. Refresh to try again."
 */
export function LoadFailed({ what, variant = 'banner' }: { what: string; variant?: 'banner' | 'inline' }) {
  const message = `Couldn't load ${what}. Refresh to try again.`;
  if (variant === 'inline') {
    return <p role="alert" className="text-sm text-destructive-strong">{message}</p>;
  }
  return (
    <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-strong">
      {message}
    </div>
  );
}
