import Link from 'next/link';
import type { PolicyVersionRow } from './policy-parsing';
import { LoadFailed } from '@/components/creditflow/LoadFailed';

/** Preserve version context in links between policy screens.
 *  The active version is the default context, so it needs no param. */
export function policyVersionQuery(version: { id: string; is_active: boolean } | null): string {
  return version && !version.is_active ? `?v=${version.id}` : '';
}

/**
 * Why mutation controls on a policy screen must be disabled, or null when they may be used.
 * Drafts and the live version are editable. Archived versions, a missing version and
 * a `?v=` that names nothing are not.
 */
export function policyEditBlockedReason(
  version: Pick<PolicyVersionRow, 'is_active' | 'is_draft'> | null,
  requestedNotFound = false,
  loadFailed = false,
): string | null {
  if (loadFailed) return 'Policy version could not be loaded.';
  if (requestedNotFound) return 'Version not found. Open a version from the policy hub to edit it.';
  if (!version) return 'No policy version exists yet. Create a draft from the policy hub first.';
  if (!version.is_active && !version.is_draft) return 'Archived versions are read-only. Open a draft to make changes.';
  return null;
}

/** Badge variant that matches the context bar: live = success, draft = info, archived = muted. */
export function policyStatusVariant(version: Pick<PolicyVersionRow, 'is_active' | 'is_draft'>): 'success' | 'info' | 'secondary' {
  if (version.is_active) return 'success';
  if (version.is_draft) return 'info';
  return 'secondary';
}

/**
 * Every /policy screen states which policy version it is operating on and
 * what editing it means (doctrine: never let a user mutate state they can't
 * see the blast radius of).
 */
export default function PolicyContextBar({ version, requestedNotFound = false, loadFailed = false, draftCount = 0, latestDraft = null }: {
  version: PolicyVersionRow | null;
  requestedNotFound?: boolean;
  loadFailed?: boolean;
  draftCount?: number;
  latestDraft?: { id: string; version_label: string } | null;
}) {
  if (loadFailed) {
    return <LoadFailed what="this policy version" />;
  }

  if (requestedNotFound) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-strong">
        <strong>Version not found.</strong> The version in this link does not exist, so nothing is shown and nothing can be edited here.{' '}
        <Link href="/policy" className="font-medium underline underline-offset-2">Choose a version on the policy hub</Link>
      </div>
    );
  }

  if (!version) {
    if (draftCount > 0 && latestDraft) {
      return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning-strong">
          <span>
            <strong>No live policy</strong> — {draftCount} {draftCount === 1 ? 'draft' : 'drafts'} waiting to be published. Editing is off until a version is live or a draft is opened.
          </span>
          <Link href={`/policy?v=${latestDraft.id}`} className="font-medium underline underline-offset-2">Open {latestDraft.version_label}</Link>
        </div>
      );
    }
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
