// Pure helpers shared by the /policy server actions and client components.
// Kept out of actions.ts because "use server" files may only export async functions.

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export type PolicyVersionRow = {
  id: string;
  version_label: string;
  is_active: boolean;
  is_draft: boolean;
  created_at?: string;
  published_at?: string | null;
};

export type PolicyVersionState = {
  /** The version the screen operates on. Null when none resolves. */
  version: PolicyVersionRow | null;
  /** True when `?v=` was given but names no existing version. Never falls back to live. */
  requestedNotFound: boolean;
  /** True when the version read failed (network, RLS, or a malformed `?v=` id). Not the same as not found. */
  loadFailed: boolean;
  /** Unpublished drafts, so screens can point at them when nothing is live. */
  draftCount: number;
  latestDraft: { id: string; version_label: string } | null;
};

export const PERSISTENCE_SCOPES = ['none', 'party', 'site', 'rm'] as const;

export const PERSISTENCE_LABELS: Record<string, string> = {
  none: 'Per case only',
  party: 'For this party across cases',
  site: 'For this site',
  rm: 'For this RM',
};

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Something went wrong. Nothing was saved.';
}

/** Empty or non-numeric input is undefined. A parsed 0 stays 0. */
export function parseNumberField(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function parseIntegerField(raw: string | null | undefined): number | undefined {
  const value = parseNumberField(raw);
  return value !== undefined && Number.isInteger(value) ? value : undefined;
}

export type ParameterFields = {
  name: string;
  subject_type: string;
  stage: number;
  default_owning_role: string;
  input_type: string;
  weight: number;
  rubric_guidance: string;
  signal_strength: string;
  signal_cost: string;
  signal_lag: string;
  sla_days: number | null;
  require_reasoning: boolean;
  is_critical: boolean;
  is_stable: boolean;
  persistence_scope: string;
};

/**
 * Parses the parameter dialog's fields. Only fields the form renders are read;
 * numbers use explicit NaN checks so 0 (weight, SLA days) is preserved.
 */
export function parseParameterForm(
  get: (key: string) => string | null,
): { ok: true; fields: ParameterFields } | { ok: false; error: string } {
  const name = (get('parameter_name') ?? '').trim();
  if (!name) return { ok: false, error: 'Parameter name is required.' };

  const stage = parseIntegerField(get('stage'));
  if (stage === undefined || stage < 1 || stage > 3) {
    return { ok: false, error: 'Stage must be a whole number from 1 to 3.' };
  }

  const weight = parseNumberField(get('weight'));
  if (weight === undefined) return { ok: false, error: 'Weight must be a number.' };
  if (weight < 0) return { ok: false, error: 'Weight cannot be negative. Use 0 to exclude this parameter.' };

  const slaRaw = get('sla_days');
  let sla_days: number | null = null;
  if (slaRaw !== null && slaRaw.trim() !== '') {
    const parsed = parseIntegerField(slaRaw);
    if (parsed === undefined || parsed < 0) {
      return { ok: false, error: 'SLA days must be a whole number of 0 or more.' };
    }
    sla_days = parsed;
  }

  const persistenceRaw = get('persistence_scope') ?? 'none';
  if (!(PERSISTENCE_SCOPES as readonly string[]).includes(persistenceRaw)) {
    return { ok: false, error: 'Unknown remember-answer setting.' };
  }

  return {
    ok: true,
    fields: {
      name,
      subject_type: get('applies_to_subject') || 'customer',
      stage,
      default_owning_role: get('default_owning_role') || 'rm',
      input_type: get('data_type') || 'grade_select',
      weight,
      rubric_guidance: get('description') ?? '',
      signal_strength: get('signal_strength') || '3',
      signal_cost: get('signal_cost') || '3',
      signal_lag: get('signal_lag') || 'Leading',
      sla_days,
      require_reasoning: get('require_reasoning') === 'true',
      is_critical: get('is_critical') === 'true',
      is_stable: get('is_stable') === 'true',
      persistence_scope: persistenceRaw,
    },
  };
}

function fmtVal(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'none';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Human-readable before→after summary for audit descriptions. */
export function changeSummary(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  fields: string[],
): string {
  if (!before) return fields.map((f) => `${f} ${fmtVal(after[f])}`).join(', ');
  const changed = fields.filter((f) => fmtVal(before[f]) !== fmtVal(after[f]));
  if (changed.length === 0) return 'no field changes';
  return changed.map((f) => `${f} ${fmtVal(before[f])}→${fmtVal(after[f])}`).join(', ');
}
