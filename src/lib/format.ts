/**
 * Shared formatting helpers — single source of truth for money, dates and
 * relative time across the product (doctrine §13.2 / §13.3).
 *
 * Money: Indian digit grouping, exact values for decisions, compact (₹L/₹Cr)
 * only for scanning. Dates: business timezone IST, exact values, relative
 * time only as a supplement.
 */

/** Exact Indian-grouped currency, e.g. ₹8,50,000 */
export function formatINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return 'Not available';
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Compact Indian currency for scanning, e.g. ₹18.0L, ₹1.2Cr */
export function formatCompactINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}k`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

const IST = 'Asia/Kolkata';

/** Exact business date, e.g. 18 Jul 2026 */
export function formatDateIST(d: string | Date | null | undefined): string {
  if (!d) return 'Not set';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST });
}

/** Exact business date+time, e.g. 18 Jul, 14:22 IST */
export function formatDateTimeIST(d: string | Date | null | undefined): string {
  if (!d) return 'Not set';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return 'Not set';
  const datePart = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });
  const timePart = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST });
  return `${datePart}, ${timePart} IST`;
}

/** Whole days from `d` until now (positive = past). */
export function daysSince(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

/** Whole days from now until `d` (negative = already past). */
export function daysUntil(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

/** Human relative time, e.g. "today", "3 days ago", "in 2 days". */
export function relativeDays(d: string | Date | null | undefined): string {
  const since = daysSince(d);
  if (since === null) return 'Unknown';
  if (since <= 0) {
    const until = Math.abs(since);
    if (until === 0) return 'today';
    if (until === 1) return 'tomorrow';
    return `in ${until} days`;
  }
  if (since === 1) return 'yesterday';
  return `${since} days ago`;
}

/** Parse the small, safe bold-markup subset used in policy rubrics. */
export function parseRubricGuidance(text: string | null | undefined): Array<Array<{ text: string; strong: boolean }>> {
  if (!text) return [];
  // Older policy rows stored line breaks as the two literal characters `\\n`.
  // Normalize those rows at render time so policy authors do not need to
  // migrate existing configuration just to make the guidance readable.
  return text.replace(/\\r?\\n/g, '\n').split(/\r?\n/).map((line) =>
    line.split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part) => ({
      text: part.startsWith('**') && part.endsWith('**') ? part.slice(2, -2) : part,
      strong: part.startsWith('**') && part.endsWith('**'),
    })),
  );
}

/** Keep native select menus scannable when policy mappings include guidance. */
export function formatPolicyOptionLabel(value: string | null | undefined): string {
  if (!value) return '';
  const firstLine = value.replace(/\\r?\\n/g, '\n').split(/\r?\n/)[0].trim();
  const concise = firstLine.split(':')[0].trim();
  return (concise || firstLine).slice(0, 80);
}
