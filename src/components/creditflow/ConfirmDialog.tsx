"use client";
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { SubmitButton } from '@/components/ui/submit-button';

/**
 * Consequence-preview confirmation (doctrine Principle 10, §14.4).
 *
 * High-consequence actions must explain what will happen before submission —
 * never a generic "Are you sure?". `consequences` lists business effects in
 * plain language; optionally requires a typed reason that is preserved.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  consequences = [],
  irreversible = false,
  requireReason = false,
  reasonLabel = 'Reason (preserved in audit)',
  confirmLabel = 'Confirm',
  tone = 'default',
  action,
  hiddenFields = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Plain-language business effects, e.g. "RM margin will be recalculated". */
  consequences?: string[];
  irreversible?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  confirmLabel?: string;
  tone?: 'default' | 'destructive';
  /** Server action invoked on confirm (form action). */
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
}) {
  const [reason, setReason] = useState('');
  const canConfirm = !requireReason || reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tone === 'destructive' && <AlertTriangle size={17} className="text-destructive" aria-hidden="true" />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {consequences.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              What will happen
            </p>
            <ul className="text-sm space-y-1 list-disc pl-4 text-foreground/90">
              {consequences.map((cItem, i) => <li key={i}>{cItem}</li>)}
            </ul>
          </div>
        )}
        {irreversible && (
          <p className="text-xs font-medium text-destructive">This action cannot be undone and will be permanently audited.</p>
        )}

        <form
          action={async (formData) => {
            await action(formData);
            onOpenChange(false);
          }}
          className="space-y-3"
        >
          {Object.entries(hiddenFields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {(requireReason || reasonLabel) && (
            <div className="space-y-1.5">
              <label htmlFor="confirm-reason" className="text-xs font-semibold text-muted-foreground">
                {reasonLabel}{requireReason && <span className="text-destructive"> *</span>}
              </label>
              <textarea
                id="confirm-reason"
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="State the business reason…"
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton
              type="submit"
              disabled={!canConfirm}
              variant={tone === 'destructive' ? 'outline' : 'default'}
              className={tone === 'destructive' ? 'border-destructive text-destructive hover:bg-destructive/10' : ''}
            >
              {confirmLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
