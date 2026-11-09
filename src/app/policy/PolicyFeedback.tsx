"use client";
import { CheckCircle2, Lock } from 'lucide-react';

/** Server error shown in place, next to the form or table that caused it. */
export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive-strong">
      {message}
    </p>
  );
}

/** Confirmation of a saved or removed change, e.g. 'Saved "Bank statement" to v4 draft.' */
export function Receipt({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success-strong">
      <CheckCircle2 size={15} aria-hidden="true" />
      {message}
    </p>
  );
}

/** Explains why editing is off on this screen. Shown instead of mutation controls. */
export function ReadOnlyNotice({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <p className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
      <Lock size={14} aria-hidden="true" />
      {reason}
    </p>
  );
}
