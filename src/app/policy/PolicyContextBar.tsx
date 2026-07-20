import Link from 'next/link';

/** Preserve version context in links between policy screens.
 *  The active version is the default context, so it needs no param. */
export function policyVersionQuery(version: { id: string; is_active: boolean } | null): string {
  return version && !version.is_active ? `?v=${version.id}` : '';
}

/**
 * Every /policy screen states which policy version it is operating on and
 * what editing it means (doctrine: never let a user mutate state they can't
 * see the blast radius of).
 */
export default function PolicyContextBar({ version }: {
  version: { id: string; version_label: string; is_active: boolean; is_draft: boolean } | null;
}) {
  if (!version) {
    return (
      <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        No policy version exists yet — use <Link href="/policy" className="font-medium underline">&ldquo;+ New Draft&rdquo; on the policy hub</Link> before configuring.
      </div>
    );
  }

  const status = version.is_active ? 'live' : version.is_draft ? 'draft' : 'archived';

  if (status === 'live') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning-strong">
        <span className="text-tiny font-bold uppercase tracking-wider rounded border border-warning/40 px-1.5 py-0.5">Live</span>
        <span>
          Editing <strong>{version.version_label}</strong> — the published policy. Changes apply immediately to open review cycles.
        </span>
        <Link href="/policy" className="font-medium underline underline-offset-2">Stage changes in a draft instead</Link>
      </div>
    );
  }

  if (status === 'draft') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-info/25 bg-info/10 px-4 py-3 text-sm text-info-strong">
        <span className="text-tiny font-bold uppercase tracking-wider rounded border border-info/40 px-1.5 py-0.5">Draft</span>
        <span>
          Editing <strong>{version.version_label}</strong> — changes take effect only when this draft is published.
        </span>
        <Link href="/policy" className="font-medium underline underline-offset-2">Switch version</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
      <span className="text-tiny font-bold uppercase tracking-wider rounded border border-border px-1.5 py-0.5">Archived</span>
      <span>
        Viewing <strong className="text-foreground">{version.version_label}</strong> — read-only history. Cycles that ran under it still reference it.
      </span>
      <Link href="/policy" className="font-medium underline underline-offset-2">Switch version</Link>
    </div>
  );
}
