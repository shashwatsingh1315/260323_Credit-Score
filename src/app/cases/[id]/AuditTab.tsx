"use client";
import { use, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatINR, formatDateIST, formatDateTimeIST } from '@/lib/format';

/**
 * History tab — doctrine Principle 18: audit is human-readable by default.
 * Raw JSON stays available behind a technical-detail control, but business
 * reviewers read plain-language changes: what changed, from what, to what,
 * by whom, when, and why.
 */

const FIELD_LABELS: Record<string, string> = {
  amount: 'Amount',
  payment_date: 'Payment date',
  promised_bill_amount: 'Promised amount',
  decided_bill_amount: 'Decided amount',
  actual_bill_amount: 'Collected amount',
  bill_amount: 'Bill amount',
  requested_exposure_amount: 'Requested exposure',
  composite_credit_days: 'Composite credit days',
  approved_credit_days: 'Approved credit days',
  status: 'Status',
  substatus: 'Substatus',
  kam_user_id: 'KAM owner',
  rm_user_id: 'RM owner',
  assigned_to: 'Assignee',
  grade_value: 'Grade',
  reason: 'Reason',
  note: 'Note',
  amount_reduced: 'Credit note amount',
};

const MONEY_FIELDS = new Set(['amount', 'promised_bill_amount', 'decided_bill_amount', 'actual_bill_amount', 'bill_amount', 'requested_exposure_amount', 'amount_reduced']);
const DATE_FIELDS = new Set(['payment_date', 'billing_date', 'due_date']);

const FILTERS: { key: string; label: string; match: RegExp }[] = [
  { key: 'all', label: 'All events', match: /.*/ },
  { key: 'decisions', label: 'Decisions', match: /approval|decision|board|vote|appeal|override/i },
  { key: 'financial', label: 'Financial', match: /payment|repayment|tranche|credit_note|write.?off|billing|ledger|extension/i },
  { key: 'tasks', label: 'Tasks & assignment', match: /task|assign|stage|waiting/i },
  { key: 'documents', label: 'Documents', match: /document|file|upload|bill_url/i },
];

function humanizeValue(field: string, value: any): string {
  if (value === null || value === undefined || value === '') return 'not set';
  if (MONEY_FIELDS.has(field) && typeof value === 'number') return formatINR(value);
  if (DATE_FIELDS.has(field)) return formatDateIST(value);
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Render one field_diff entry as a business-language change line. */
function humanizeDiff(field: string, diff: any): string | null {
  const label = FIELD_LABELS[field] || field.replace(/_/g, ' ');
  if (diff && typeof diff === 'object' && ('from' in diff || 'to' in diff)) {
    return `${label} changed from ${humanizeValue(field, diff.from)} to ${humanizeValue(field, diff.to)}`;
  }
  return null;
}

export default function AuditTab({ promises }: any) {
  const { auditEvents } = use(promises.auditPromise as Promise<any>);
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
    return (auditEvents || []).filter((e: any) => f.match.test(`${e.event_type} ${e.description}`));
  }, [auditEvents, filter]);

  if ((auditEvents || []).length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          No history yet. Decisions, financial changes and assignments will appear here in plain language.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter history by category">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? 'default' : 'secondary'}
            className="text-xs"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No events in this category.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <ol className="relative pl-6 space-y-0">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-border" aria-hidden="true" />
              {filtered.map((e: any) => {
                const diffs = e.field_diffs && typeof e.field_diffs === 'object' ? e.field_diffs : null;
                const readable = diffs
                  ? Object.entries(diffs).map(([k, v]) => humanizeDiff(k, v)).filter(Boolean) as string[]
                  : [];
                const hasUnreadable = diffs && Object.keys(diffs).length > readable.length;

                return (
                  <li key={e.id} className="relative pb-5 last:pb-0">
                    <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" aria-hidden="true" />
                    <p className="text-sm font-medium leading-tight">{e.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      By {e.actor?.full_name || 'System'} · {formatDateTimeIST(e.created_at)}
                    </p>
                    {readable.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {readable.map((line, i) => (
                          <li key={i} className="text-xs text-foreground/85">{line}</li>
                        ))}
                      </ul>
                    )}
                    {diffs && hasUnreadable && (
                      <details className="mt-1.5">
                        <summary className="text-tiny text-muted-foreground cursor-pointer hover:text-foreground">
                          Technical details
                        </summary>
                        <pre className="mt-1 text-tiny bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(diffs, null, 2)}</pre>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
