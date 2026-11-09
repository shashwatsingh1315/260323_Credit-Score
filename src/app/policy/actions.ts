"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent, isAdmin, type UserProfile } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  changeSummary,
  errorMessage,
  parseIntegerField,
  parseNumberField,
  parseParameterForm,
  type ActionResult,
  type PolicyVersionRow,
  type PolicyVersionState,
} from './policy-parsing';

type PolicyClient = Awaited<ReturnType<typeof createClient>>;
/** A versioned policy row as read from the DB. Only `policy_version_id` is relied on by the guards. */
type VersionedRow = Record<string, unknown> & { policy_version_id?: string | null };
type AutoBandConfig = { mappings?: Array<{ value?: unknown }> } | null;
type PolicyRow = VersionedRow & { id: string };
type WeightRow = { persona_id: string; parameter_id: string; weight: unknown };

// ── Policy Versions ─────────────────────────────────────────────────────────

export async function fetchPolicyVersions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('policy_versions')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function fetchActivePolicy() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('policy_versions')
    .select('*')
    .eq('is_active', true)
    .single();
  return data;
}

export async function fetchPolicyVersionCounts(versionId: string) {
  const supabase = await createClient();
  const [parameters, bands, personas] = await Promise.all([
    supabase.from('parameter_definitions').select('id', { count: 'exact', head: true }).eq('policy_version_id', versionId).eq('is_active', true),
    supabase.from('score_bands').select('id', { count: 'exact', head: true }).eq('policy_version_id', versionId),
    supabase.from('personas').select('id', { count: 'exact' }).eq('policy_version_id', versionId),
  ]);
  const personaIds = (personas.data || []).map((persona) => persona.id);
  const weights = personaIds.length > 0
    ? await supabase.from('weight_matrices').select('id', { count: 'exact', head: true }).in('persona_id', personaIds)
    : { count: 0 };
  return { parameters: parameters.count || 0, bands: bands.count || 0, personas: personas.count || 0, weights: weights.count || 0 };
}

/**
 * Resolve which policy version a /policy screen operates on, and report what
 * the screen should say when it cannot.
 * - `?v=<id>` selects that version. If it names nothing, `requestedNotFound` is
 *   set and the screen shows "Version not found". It never falls back to live.
 * - Otherwise the active version. Drafts are reported so the screen can point at them.
 */
export async function resolvePolicyVersionState(versionParam?: string): Promise<PolicyVersionState> {
  const supabase = await createClient();
  let version: PolicyVersionRow | null = null;
  let requestedNotFound = false;
  let loadFailed = false;

  if (versionParam) {
    const { data, error } = await supabase
      .from('policy_versions')
      .select('*')
      .eq('id', versionParam)
      .maybeSingle();
    // A read error (including a malformed id that Postgres rejects) is a failed load, not a missing version.
    if (error) loadFailed = true;
    else if (data) version = data as PolicyVersionRow;
    else requestedNotFound = true;
  } else {
    const { data, error } = await supabase
      .from('policy_versions')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    if (error) loadFailed = true;
    version = (data as PolicyVersionRow | null) ?? null;
  }

  const { data: drafts } = await supabase
    .from('policy_versions')
    .select('id, version_label')
    .eq('is_draft', true)
    .order('created_at', { ascending: false });
  const draftRows = drafts ?? [];

  return {
    version,
    requestedNotFound,
    loadFailed,
    draftCount: draftRows.length,
    latestDraft: draftRows[0] ? { id: draftRows[0].id, version_label: draftRows[0].version_label } : null,
  };
}

/** Convenience wrapper: the resolved version, or null (no fallback when `?v=` is invalid). */
export async function resolvePolicyVersion(versionParam?: string) {
  const state = await resolvePolicyVersionState(versionParam);
  return state.requestedNotFound ? null : state.version;
}

// ── Guards and helpers ──────────────────────────────────────────────────────

async function requireAdmin(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');
  return user;
}

/** Drafts and the active version are editable; archived versions are history
 *  that in-flight/closed cycles still reference — never mutate them. */
async function assertEditableVersion(supabase: PolicyClient, versionId: string | null | undefined): Promise<PolicyVersionRow | null> {
  if (!versionId) return null;
  const { data } = await supabase
    .from('policy_versions')
    .select('id, version_label, is_active, is_draft')
    .eq('id', versionId)
    .maybeSingle();
  if (!data) throw new Error('Policy version not found.');
  if (!data.is_active && !data.is_draft) {
    throw new Error(`'${data.version_label}' is archived. Archived versions are read-only. Create a draft to make changes.`);
  }
  return data as PolicyVersionRow;
}

/** Version a new record attaches to: the requested one (must be editable), else the live version. */
async function resolveCreateVersion(supabase: PolicyClient, versionId: string | null | undefined): Promise<PolicyVersionRow> {
  if (versionId) {
    const version = await assertEditableVersion(supabase, versionId);
    if (version) return version;
  }
  const { data } = await supabase
    .from('policy_versions')
    .select('id, version_label, is_active, is_draft')
    .eq('is_active', true)
    .maybeSingle();
  if (!data) throw new Error('No live policy exists to attach this to. Publish or create a draft first.');
  return data as PolicyVersionRow;
}

/** Loads a row for update or delete and checks its version is editable. */
async function loadEditableRow(supabase: PolicyClient, table: string, id: string): Promise<{ row: VersionedRow; version: PolicyVersionRow }> {
  const { data } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (!data) throw new Error('Record not found. It may have been removed by someone else. Refresh and try again.');
  const row = data as VersionedRow;
  const version = await assertEditableVersion(supabase, row.policy_version_id);
  if (!version) throw new Error('Record has no policy version.');
  return { row, version };
}

function versionLabel(version: PolicyVersionRow): string {
  return version.is_active ? `${version.version_label} (live)` : `${version.version_label} draft`;
}

/** Runs a mutation, revalidates on success, and turns any thrown error into an inline result. */
async function mutate(revalidate: string, work: () => Promise<string>): Promise<ActionResult> {
  try {
    const message = await work();
    revalidatePath(revalidate);
    return { ok: true, message };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

function pick(source: Record<string, unknown> | null, fields: string[]): Record<string, unknown> | null {
  if (!source) return null;
  return Object.fromEntries(fields.map((f) => [f, source[f] ?? null]));
}

/**
 * Writes an insert or update on a versioned row, checks the Supabase error, and
 * only then writes the audit event (with the version label, entity name and before→after values).
 */
async function saveVersionedRow(supabase: PolicyClient, actorId: string, opts: {
  table: string;
  id?: string;
  versionId: string | null;
  payload: Record<string, unknown>;
  fields: string[];
  eventType: string;
  entity: string;
  subject: string;
}): Promise<{ version: PolicyVersionRow; message: string }> {
  let before: VersionedRow | null = null;
  let version: PolicyVersionRow;
  if (opts.id) {
    const loaded = await loadEditableRow(supabase, opts.table, opts.id);
    before = loaded.row;
    version = loaded.version;
    const { error } = await supabase.from(opts.table).update(opts.payload).eq('id', opts.id);
    if (error) throw new Error(error.message);
  } else {
    version = await resolveCreateVersion(supabase, opts.versionId);
    const { error } = await supabase.from(opts.table).insert({ ...opts.payload, policy_version_id: version.id });
    if (error) throw new Error(error.message);
  }

  const summary = opts.id
    ? `${opts.subject} updated: ${changeSummary(before, opts.payload, opts.fields)}`
    : `${opts.subject} added: ${changeSummary(null, opts.payload, opts.fields)}`;
  await logAuditEvent({
    event_type: opts.eventType,
    actor_id: actorId,
    description: `${versionLabel(version)}: ${summary}`,
    field_diffs: { before: pick(before, opts.fields), after: pick(opts.payload, opts.fields) },
    metadata: { policy_version_id: version.id, entity: opts.entity, entity_id: opts.id ?? null },
  });
  return { version, message: `Saved ${opts.subject} to ${versionLabel(version)}.` };
}

/** Deletes (or archives, for soft-delete tables) a versioned row with a confirmed write and a detailed audit event. */
async function removeVersionedRow(supabase: PolicyClient, actorId: string, opts: {
  table: string;
  id: string;
  soft?: boolean;
  eventType: string;
  entity: string;
  describe: (row: VersionedRow) => string;
  /** Plain message for Postgres 23503 (a foreign key still references the row). */
  inUseMessage?: string;
}): Promise<string> {
  const { row, version } = await loadEditableRow(supabase, opts.table, opts.id);
  const query = opts.soft
    ? supabase.from(opts.table).update({ is_active: false }).eq('id', opts.id)
    : supabase.from(opts.table).delete().eq('id', opts.id);
  const { error } = await query;
  if (error) {
    const inUse = error.code === '23503' && opts.inUseMessage;
    throw new Error(inUse ? opts.inUseMessage : error.message);
  }

  const verb = opts.soft ? 'archived' : 'removed';
  await logAuditEvent({
    event_type: opts.eventType,
    actor_id: actorId,
    description: `${versionLabel(version)}: ${opts.describe(row)} ${verb}.`,
    field_diffs: { before: row },
    metadata: { policy_version_id: version.id, entity: opts.entity, entity_id: opts.id },
  });
  return `${opts.describe(row)} ${verb} from ${versionLabel(version)}.`;
}

// ── Policy version lifecycle (confirmed in ConfirmDialog; these throw on failure) ──

export async function createNewDraft(formData: FormData) {
  const user = await requireAdmin();

  const supabase = await createClient();

  // Calculate next version label based on count
  const { count } = await supabase.from('policy_versions').select('*', { count: 'exact', head: true });
  const nextVersion = (count || 0) + 1;

  const { data: draft, error } = await supabase.from('policy_versions').insert({
    version_label: (formData.get('label') as string) || `v${nextVersion}.0 Draft`,
    is_draft: true,
    is_active: false,
    created_by: user.id,
  }).select().single();

  if (error) throw new Error(error.message);

  // Clone the active policy's full configuration into the draft so admins
  // stage changes against a complete copy instead of rebuilding from scratch
  // (or worse, editing the live policy that in-flight cycles score against).
  const { data: activePolicy } = await supabase
    .from('policy_versions')
    .select('id, version_label')
    .eq('is_active', true)
    .maybeSingle();

  let cloneSummary = 'empty (no active policy to clone)';
  if (activePolicy) {
    const src = activePolicy.id;
    const [paramsRes, gradesRes, bandsRes, personasRes, domRes, routingRes, validityRes, maxTotalsRes] = await Promise.all([
      supabase.from('parameter_definitions').select('*').eq('policy_version_id', src),
      supabase.from('grade_scale').select('*').eq('policy_version_id', src),
      supabase.from('score_bands').select('*').eq('policy_version_id', src),
      supabase.from('personas').select('*').eq('policy_version_id', src),
      supabase.from('dominance_categories').select('*').eq('policy_version_id', src),
      supabase.from('routing_thresholds').select('*').eq('policy_version_id', src),
      supabase.from('validity_rules').select('*').eq('policy_version_id', src),
      supabase.from('stage_max_totals').select('*').eq('policy_version_id', src),
    ]);

    const reparent = (row: PolicyRow) => {
      const rest = Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'id' && key !== 'created_at'));
      return { ...rest, policy_version_id: draft.id };
    };

    // Parameters and personas need id maps so weight matrices can be remapped.
    const paramIdMap = new Map<string, string>();
    const personaIdMap = new Map<string, string>();

    await Promise.all([
      ...(paramsRes.data || []).map(async (p: PolicyRow) => {
        const { data: inserted, error: insErr } = await supabase
          .from('parameter_definitions').insert(reparent(p)).select('id').single();
        if (insErr) throw new Error(`Clone failed (parameter '${p.name}'): ${insErr.message}`);
        paramIdMap.set(p.id, inserted.id);
      }),
      ...(personasRes.data || []).map(async (p: PolicyRow) => {
        const { data: inserted, error: insErr } = await supabase
          .from('personas').insert(reparent(p)).select('id').single();
        if (insErr) throw new Error(`Clone failed (persona '${p.name}'): ${insErr.message}`);
        personaIdMap.set(p.id, inserted.id);
      }),
    ]);

    const bulkInserts: PromiseLike<void>[] = [];
    const bulk = (table: string, rows: PolicyRow[] | null) => {
      if (rows && rows.length > 0) {
        bulkInserts.push(
          supabase.from(table).insert(rows.map(reparent)).then(({ error: insErr }) => {
            if (insErr) throw new Error(`Clone failed (${table}): ${insErr.message}`);
          })
        );
      }
    };
    bulk('grade_scale', gradesRes.data);
    bulk('score_bands', bandsRes.data);
    bulk('dominance_categories', domRes.data);
    bulk('routing_thresholds', routingRes.data);
    bulk('validity_rules', validityRes.data);
    bulk('stage_max_totals', maxTotalsRes.data);

    // Weight matrices hang off personas — remap both foreign keys.
    if (personaIdMap.size > 0) {
      const { data: weights } = await supabase
        .from('weight_matrices')
        .select('persona_id, parameter_id, weight')
        .in('persona_id', Array.from(personaIdMap.keys()));
      const remapped = (weights || [])
        .filter((w: WeightRow) => personaIdMap.has(w.persona_id) && paramIdMap.has(w.parameter_id))
        .map((w: WeightRow) => ({
          persona_id: personaIdMap.get(w.persona_id),
          parameter_id: paramIdMap.get(w.parameter_id),
          weight: w.weight,
        }));
      if (remapped.length > 0) {
        bulkInserts.push(
          supabase.from('weight_matrices').insert(remapped).then(({ error: insErr }) => {
            if (insErr) throw new Error(`Clone failed (weight_matrices): ${insErr.message}`);
          })
        );
      }
    }

    await Promise.all(bulkInserts);
    cloneSummary = `cloned from ${activePolicy.version_label}`;
  }

  await logAuditEvent({ event_type: 'policy_draft_created', actor_id: user.id, description: `Draft policy '${draft.version_label}' created (${cloneSummary}).` });
  revalidatePath('/policy');
}

export async function publishDraftPolicy(formData: FormData) {
  const user = await requireAdmin();

  const supabase = await createClient();
  const versionId = formData.get('versionId') as string;
  if (!versionId) throw new Error('Select a draft to publish.');

  const { data: target, error: targetError } = await supabase
    .from('policy_versions')
    .select('id, version_label, is_draft, is_active')
    .eq('id', versionId)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) throw new Error('Policy version not found.');
  if (!target.is_draft) throw new Error(`'${target.version_label}' is not a draft and cannot be published.`);

  // Archive current active
  const { error: archiveError } = await supabase.from('policy_versions').update({ is_active: false, is_draft: false }).eq('is_active', true);
  if (archiveError) throw new Error(archiveError.message);
  // Publish new
  const { error: publishError } = await supabase.from('policy_versions').update({
    is_active: true,
    is_draft: false,
    published_at: new Date().toISOString(),
  }).eq('id', versionId);
  if (publishError) throw new Error(publishError.message);

  // Purge stale preapproved bands; readers will repopulate lazily under the new policy.
  const { error: purgeError } = await supabase.rpc('refresh_party_preapproved_bands');
  if (purgeError) throw new Error(purgeError.message);

  await logAuditEvent({ event_type: 'policy_published', actor_id: user.id, description: `Policy '${target.version_label}' published.`, metadata: { policy_version_id: versionId } });
  revalidatePath('/policy');
}

export async function activateArchivedPolicy(formData: FormData) {
  const user = await requireAdmin();

  const versionId = formData.get('versionId') as string;
  if (!versionId) throw new Error('Select a policy version to use.');

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from('policy_versions')
    .select('id, version_label, is_active, is_draft')
    .eq('id', versionId)
    .maybeSingle();

  if (targetError || !target) throw targetError || new Error('Policy version not found.');
  if (target.is_draft) throw new Error('Publish a draft before using it for new cases.');
  if (target.is_active) return;

  const { data: outgoing } = await supabase
    .from('policy_versions')
    .select('id, version_label')
    .eq('is_active', true)
    .maybeSingle();

  const { error: archiveError } = await supabase
    .from('policy_versions')
    .update({ is_active: false, is_draft: false })
    .eq('is_active', true);
  if (archiveError) throw archiveError;

  const { error: activateError } = await supabase
    .from('policy_versions')
    .update({ is_active: true, is_draft: false })
    .eq('id', target.id)
    .eq('is_draft', false);

  if (activateError) {
    // Best-effort recovery keeps submissions usable if activating the selected
    // historical version fails after the outgoing policy was archived.
    if (outgoing?.id) {
      await supabase.from('policy_versions').update({ is_active: true }).eq('id', outgoing.id);
    }
    throw activateError;
  }

  const { error: purgeError } = await supabase.rpc('refresh_party_preapproved_bands');
  if (purgeError) throw new Error(purgeError.message);
  await logAuditEvent({
    event_type: 'policy_reactivated',
    actor_id: user.id,
    description: `Archived policy '${target.version_label}' reactivated${outgoing ? ` in place of '${outgoing.version_label}'` : ''}.`,
    metadata: { policy_version_id: target.id },
  });
  revalidatePath('/policy');
}

export async function discardDraftPolicy(formData: FormData) {
  const user = await requireAdmin();
  const versionId = formData.get('versionId') as string;
  const supabase = await createClient();
  const { data: draft } = await supabase.from('policy_versions').select('version_label, is_draft, is_active').eq('id', versionId).maybeSingle();
  if (!draft?.is_draft || draft.is_active) throw new Error('Only an unpublished draft can be discarded.');
  const { error } = await supabase.from('policy_versions').delete().eq('id', versionId).eq('is_draft', true).eq('is_active', false);
  if (error) throw new Error(error.message);
  await logAuditEvent({ event_type: 'policy_draft_discarded', actor_id: user.id, description: `Draft policy '${draft.version_label}' discarded. Child configuration was removed by cascade.`, metadata: { policy_version_id: versionId } });
  revalidatePath('/policy');
}

// ── Scoring Parameters ──────────────────────────────────────────────────────

export async function fetchParameters(versionId?: string) {
  const supabase = await createClient();

  let targetVersionId = versionId;

  if (!targetVersionId) {
    const { data: activePolicy } = await supabase
      .from('policy_versions')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    targetVersionId = activePolicy?.id;
  }

  if (!targetVersionId) return [];

  const { data } = await supabase
    .from('parameter_definitions')
    .select('*')
    .eq('policy_version_id', targetVersionId)
    .eq('is_active', true)
    .order('name');
  return data || [];
}

const PARAMETER_FIELDS = [
  'name', 'subject_type', 'stage', 'default_owning_role', 'input_type', 'weight', 'rubric_guidance',
  'signal_strength', 'signal_cost', 'signal_lag', 'sla_days', 'require_reasoning', 'is_critical',
  'is_stable', 'persistence_scope', 'auto_band_config',
];

export async function upsertParameter(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();

  const parsed = parseParameterForm((key) => formData.get(key) as string | null);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const fields = parsed.fields;

  let autoBandConfig: AutoBandConfig = null;
  const autoBandConfigStr = formData.get('auto_band_config') as string;
  if (autoBandConfigStr) {
    try {
      autoBandConfig = JSON.parse(autoBandConfigStr) as AutoBandConfig;
    } catch {
      return { ok: false, error: 'The auto-mapping rules could not be read. Re-enter them or upload the CSV again.' };
    }
  }

  if (fields.input_type === 'yes_no') {
    const mappings = autoBandConfig?.mappings;
    const values = new Set((mappings || []).map((mapping) => String(mapping.value).toLowerCase()));
    if (!values.has('yes') || !values.has('no')) {
      return { ok: false, error: 'Yes/No parameters require both Yes and No grade mappings.' };
    }
  }

  const id = (formData.get('id') as string) || undefined;
  return mutate('/policy/parameters', async () => {
    const supabase = await createClient();
    const payload = { ...fields, auto_band_config: autoBandConfig };
    const { message } = await saveVersionedRow(supabase, user.id, {
      table: 'parameter_definitions',
      id,
      versionId: (formData.get('policy_version_id') as string) || null,
      payload,
      fields: PARAMETER_FIELDS,
      eventType: 'parameter_updated',
      entity: 'parameter',
      subject: `Parameter "${fields.name}"`,
    });
    return message;
  });
}

export async function deleteParameter(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = formData.get('id') as string;
  return mutate('/policy/parameters', async () => {
    const supabase = await createClient();
    return removeVersionedRow(supabase, user.id, {
      table: 'parameter_definitions',
      id,
      soft: true,
      eventType: 'parameter_deleted',
      entity: 'parameter',
      describe: (row) => `Parameter "${row.name}" (stage ${row.stage}, weight ${row.weight})`,
    });
  });
}

// ── Grade Scales ────────────────────────────────────────────────────────────

export async function fetchGradeScales(versionId?: string) {
  const supabase = await createClient();
  let targetId = versionId;
  if (!targetId) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).maybeSingle();
    targetId = activePolicy?.id;
  }
  if (!targetId) return [];

  const { data } = await supabase
    .from('grade_scale')
    .select('*')
    .eq('policy_version_id', targetId)
    .order('grade_value', { ascending: false });
  return data || [];
}

export async function upsertGradeDefinition(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const label = (formData.get('grade_label') as string | null)?.trim() ?? '';
  if (!label) return { ok: false, error: 'Grade label is required.' };
  const gradeValue = parseNumberField(formData.get('grade_value') as string | null);
  if (gradeValue === undefined) return { ok: false, error: 'Grade value must be a number. 0 is allowed.' };

  const id = (formData.get('id') as string) || undefined;
  return mutate('/policy/grades', async () => {
    const supabase = await createClient();
    const { message } = await saveVersionedRow(supabase, user.id, {
      table: 'grade_scale',
      id,
      versionId: (formData.get('policy_version_id') as string) || null,
      payload: {
        grade_label: label,
        grade_value: gradeValue,
        description: (formData.get('description') as string) ?? '',
      },
      fields: ['grade_label', 'grade_value', 'description'],
      eventType: 'grade_definition_updated',
      entity: 'grade',
      subject: `Grade "${label}" (value ${gradeValue})`,
    });
    return message;
  });
}

// ── Score Bands ─────────────────────────────────────────────────────────────

export async function fetchScoreBands(versionId?: string) {
  const supabase = await createClient();
  let targetId = versionId;
  if (!targetId) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).maybeSingle();
    targetId = activePolicy?.id;
  }
  if (!targetId) return [];

  const { data } = await supabase
    .from('score_bands')
    .select('*')
    .eq('policy_version_id', targetId)
    .order('min_score', { ascending: false });
  return data || [];
}

export async function upsertScoreBand(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const name = (formData.get('band_name') as string | null)?.trim() ?? '';
  if (!name) return { ok: false, error: 'Band name is required.' };
  const minScore = parseNumberField(formData.get('min_score') as string | null);
  const maxScore = parseNumberField(formData.get('max_score') as string | null);
  if (minScore === undefined || maxScore === undefined) return { ok: false, error: 'Min and max score must be numbers.' };
  if (minScore > maxScore) return { ok: false, error: 'Min score cannot be greater than max score.' };
  const creditDays = parseIntegerField(formData.get('approved_credit_days') as string | null);
  if (creditDays === undefined || creditDays < 0) return { ok: false, error: 'Approved credit days must be a whole number of 0 or more.' };

  const id = (formData.get('id') as string) || undefined;
  return mutate('/policy/bands', async () => {
    const supabase = await createClient();
    const { message } = await saveVersionedRow(supabase, user.id, {
      table: 'score_bands',
      id,
      versionId: (formData.get('policy_version_id') as string) || null,
      payload: {
        band_name: name,
        min_score: minScore,
        max_score: maxScore,
        approved_credit_days: creditDays,
        is_ambiguity_band: formData.get('is_ambiguity_band') === 'true',
      },
      fields: ['band_name', 'min_score', 'max_score', 'approved_credit_days', 'is_ambiguity_band'],
      eventType: 'score_band_updated',
      entity: 'score_band',
      subject: `Band "${name}"`,
    });
    return message;
  });
}

export async function deleteScoreBand(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = formData.get('id') as string;
  return mutate('/policy/bands', async () => {
    const supabase = await createClient();
    return removeVersionedRow(supabase, user.id, {
      table: 'score_bands',
      id,
      eventType: 'score_band_deleted',
      entity: 'score_band',
      describe: (row) => `Band "${row.band_name}" (${row.min_score}–${row.max_score}, ${row.approved_credit_days} days)`,
    });
  });
}

// ── Persona Definitions ──────────────────────────────────────────────────────

export async function fetchPersonas(versionId?: string) {
  const supabase = await createClient();
  let targetId = versionId;
  if (!targetId) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).maybeSingle();
    targetId = activePolicy?.id;
  }
  if (!targetId) return [];

  const { data } = await supabase
    .from('personas')
    .select('*')
    .eq('policy_version_id', targetId)
    .order('name');
  return data || [];
}

export async function upsertPersona(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const name = (formData.get('persona_name') as string | null)?.trim() ?? '';
  if (!name) return { ok: false, error: 'Persona name is required.' };
  const gateEnabled = formData.get('minimum_score_enabled') === 'true';
  const minimumScore = gateEnabled ? parseNumberField(formData.get('minimum_score') as string | null) : null;
  if (gateEnabled && minimumScore === undefined) return { ok: false, error: 'Minimum score must be a number.' };

  const id = (formData.get('id') as string) || undefined;
  return mutate('/policy/personas', async () => {
    const supabase = await createClient();
    const { message } = await saveVersionedRow(supabase, user.id, {
      table: 'personas',
      id,
      versionId: (formData.get('policy_version_id') as string) || null,
      payload: {
        name,
        description: (formData.get('description') as string) ?? '',
        minimum_score: minimumScore ?? null,
      },
      fields: ['name', 'description', 'minimum_score'],
      eventType: 'persona_updated',
      entity: 'persona',
      subject: `Persona "${name}"`,
    });
    return message;
  });
}

// ── Dominance Categories ─────────────────────────────────────────────────────

export async function fetchDominanceCategories(versionId?: string) {
  const supabase = await createClient();
  let targetId = versionId;
  if (!targetId) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).maybeSingle();
    targetId = activePolicy?.id;
  }
  if (!targetId) return [];

  const { data } = await supabase
    .from('dominance_categories')
    .select('*')
    .eq('policy_version_id', targetId)
    .order('name');
  return data || [];
}

const DOMINANCE_METHODS = ['weighted', 'power_law', 'customer_only', 'contractor_only'];

/** Review cycles that reference a dominance category. The FK has no ON DELETE rule, so these block removal. */
async function countCyclesUsingDominance(supabase: PolicyClient, categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('review_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('dominance_category_id', categoryId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** How many review cycles use a dominance category, for the removal confirmation. */
export async function fetchDominanceCategoryUsage(categoryId: string): Promise<number> {
  await requireAdmin();
  const supabase = await createClient();
  return countCyclesUsingDominance(supabase, categoryId);
}

export async function upsertDominanceCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!name) return { ok: false, error: 'Category name is required.' };
  const method = (formData.get('combination_method') as string) || 'weighted';
  if (!DOMINANCE_METHODS.includes(method)) return { ok: false, error: 'Unknown combination method.' };

  const id = (formData.get('id') as string) || undefined;
  return mutate('/policy/dominance', async () => {
    const supabase = await createClient();
    // Fields the form did not render keep their stored value rather than a default.
    const existing = id ? await loadEditableRow(supabase, 'dominance_categories', id) : null;
    const prev = existing?.row as { customer_weight?: number; contractor_weight?: number; exponent?: number } | undefined;

    const customerWeight = parseNumberField(formData.get('customer_weight') as string | null) ?? prev?.customer_weight ?? 0.5;
    const contractorWeight = parseNumberField(formData.get('contractor_weight') as string | null) ?? prev?.contractor_weight ?? 0.5;
    const exponent = parseNumberField(formData.get('exponent') as string | null) ?? prev?.exponent ?? 1.0;
    if (customerWeight < 0 || contractorWeight < 0) throw new Error('Weights cannot be negative.');
    if (exponent < 0) throw new Error('Exponent cannot be negative.');
    if (method === 'weighted' && Math.abs(customerWeight + contractorWeight - 1) > 0.005) {
      throw new Error(`A weighted blend needs customer and contractor weights that add up to 1.00 (currently ${(customerWeight + contractorWeight).toFixed(2)}).`);
    }

    const { message } = await saveVersionedRow(supabase, user.id, {
      table: 'dominance_categories',
      id,
      versionId: (formData.get('policy_version_id') as string) || null,
      payload: { name, customer_weight: customerWeight, contractor_weight: contractorWeight, combination_method: method, exponent },
      fields: ['name', 'customer_weight', 'contractor_weight', 'combination_method', 'exponent'],
      eventType: 'dominance_category_updated',
      entity: 'dominance_category',
      subject: `Dominance category "${name}"`,
    });
    return message;
  });
}

export async function deleteDominanceCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = formData.get('id') as string;
  return mutate('/policy/dominance', async () => {
    const supabase = await createClient();
    const cycles = await countCyclesUsingDominance(supabase, id);
    if (cycles > 0) {
      throw new Error(`This category is used by ${cycles} review cycle${cycles === 1 ? '' : 's'} and cannot be removed.`);
    }
    return removeVersionedRow(supabase, user.id, {
      table: 'dominance_categories',
      id,
      eventType: 'dominance_category_deleted',
      entity: 'dominance_category',
      describe: (row) => `Dominance category "${row.name}" (${row.combination_method}, customer ${row.customer_weight}, contractor ${row.contractor_weight})`,
      inUseMessage: 'This category is used by existing review cycles and cannot be removed.',
    });
  });
}

// ── Routing & Validity Rules ────────────────────────────────────────────────

export async function fetchRoutingRules(versionId?: string) {
  const supabase = await createClient();
  let targetId = versionId;
  if (!targetId) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).maybeSingle();
    targetId = activePolicy?.id;
  }
  if (!targetId) return [];

  const { data } = await supabase
    .from('routing_thresholds')
    .select('*')
    .eq('policy_version_id', targetId)
    .order('created_at', { ascending: false });
  return data || [];
}

/** Parses the JSON context rule the client builds. Must be a plain object. */
function parseContextRule(raw: string | null): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || '{}');
  } catch {
    throw new Error('The context rule could not be read. Re-enter the conditions and try again.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The context rule must be an object.');
  return parsed as Record<string, unknown>;
}

export async function upsertRoutingRule(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = (formData.get('id') as string) || undefined;

  const targetStage = parseIntegerField(formData.get('target_stage') as string | null);
  if (targetStage === undefined || targetStage < 1 || targetStage > 3) return { ok: false, error: 'Target stage must be 1, 2 or 3.' };

  return mutate('/policy/routing', async () => {
    // An empty rule is valid: routingRuleMatches treats it as always matching.
    const contextRule = parseContextRule(formData.get('context_rule') as string | null);
    const supabase = await createClient();
    const { message } = await saveVersionedRow(supabase, user.id, {
      table: 'routing_thresholds',
      id,
      versionId: (formData.get('policy_version_id') as string) || null,
      payload: { context_rule: contextRule, target_stage: targetStage },
      fields: ['context_rule', 'target_stage'],
      eventType: 'routing_rule_updated',
      entity: 'routing_rule',
      subject: `Routing rule (${JSON.stringify(contextRule)} → Stage ${targetStage})`,
    });
    return message;
  });
}

export async function deleteRoutingRule(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = formData.get('id') as string;
  return mutate('/policy/routing', async () => {
    const supabase = await createClient();
    return removeVersionedRow(supabase, user.id, {
      table: 'routing_thresholds',
      id,
      eventType: 'routing_rule_deleted',
      entity: 'routing_rule',
      describe: (row) => `Routing rule (${JSON.stringify(row.context_rule)} → Stage ${row.target_stage})`,
    });
  });
}

export async function fetchValidityRules(versionId?: string) {
  const supabase = await createClient();
  let targetId = versionId;
  if (!targetId) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).maybeSingle();
    targetId = activePolicy?.id;
  }
  if (!targetId) return [];

  const { data } = await supabase
    .from('validity_rules')
    .select('*')
    .eq('policy_version_id', targetId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function upsertValidityRule(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = (formData.get('id') as string) || undefined;

  const validityDays = parseIntegerField(formData.get('validity_days') as string | null);
  if (validityDays === undefined || validityDays < 1) return { ok: false, error: 'Validity window must be a whole number of at least 1 day.' };

  return mutate('/policy/validity', async () => {
    const contextRule = parseContextRule(formData.get('context_rule') as string | null);
    const supabase = await createClient();
    const { message } = await saveVersionedRow(supabase, user.id, {
      table: 'validity_rules',
      id,
      versionId: (formData.get('policy_version_id') as string) || null,
      payload: { context_rule: contextRule, validity_days: validityDays },
      fields: ['context_rule', 'validity_days'],
      eventType: 'validity_rule_updated',
      entity: 'validity_rule',
      subject: `Validity rule (${Object.keys(contextRule).length ? JSON.stringify(contextRule) : 'all approvals'}, ${validityDays} days)`,
    });
    return message;
  });
}

export async function deleteValidityRule(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = formData.get('id') as string;
  return mutate('/policy/validity', async () => {
    const supabase = await createClient();
    return removeVersionedRow(supabase, user.id, {
      table: 'validity_rules',
      id,
      eventType: 'validity_rule_deleted',
      entity: 'validity_rule',
      describe: (row) => `Validity rule (${row.validity_days} days, ${Object.keys(row.context_rule ?? {}).length ? JSON.stringify(row.context_rule) : 'all approvals'})`,
    });
  });
}

// ── Stage Max Totals ────────────────────────────────────────────────────────

export async function fetchStageMaxTotals(versionId?: string) {
  const supabase = await createClient();
  let targetId = versionId;
  if (!targetId) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).maybeSingle();
    targetId = activePolicy?.id;
  }
  if (!targetId) return [];

  const { data } = await supabase
    .from('stage_max_totals')
    .select('*')
    .eq('policy_version_id', targetId)
    .order('stage');
  return data || [];
}

export async function upsertStageMaxTotal(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = (formData.get('id') as string) || undefined;
  const stage = parseIntegerField(formData.get('stage') as string | null);
  if (stage === undefined || stage < 1 || stage > 3) return { ok: false, error: 'Stage must be 1, 2 or 3.' };
  const maxTotal = parseNumberField(formData.get('max_total') as string | null);
  if (maxTotal === undefined || maxTotal < 0) return { ok: false, error: 'Max total must be a number of 0 or more.' };

  return mutate('/policy/stages', async () => {
    const supabase = await createClient();
    const { message } = await saveVersionedRow(supabase, user.id, {
      table: 'stage_max_totals',
      id,
      versionId: (formData.get('policy_version_id') as string) || null,
      payload: { stage, max_total: maxTotal },
      fields: ['stage', 'max_total'],
      eventType: 'stage_max_total_updated',
      entity: 'stage_max_total',
      subject: `Stage ${stage} max total`,
    });
    return message;
  });
}

// ── Weight Matrices ─────────────────────────────────────────────────────────

export async function fetchWeightMatrices(versionId?: string) {
  const supabase = await createClient();
  let targetId = versionId;
  if (!targetId) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).maybeSingle();
    targetId = activePolicy?.id;
  }
  if (!targetId) return [];

  // Weights are linked to personas and parameters, which are versioned.
  // We filter weights where the persona belongs to the target policy version.
  const { data } = await supabase
    .from('weight_matrices')
    .select(`
      *,
      persona:personas!inner(name, policy_version_id),
      parameter:parameter_definitions(name, stage)
    `)
    .eq('persona.policy_version_id', targetId);

  return data || [];
}

/** Weight matrices carry no policy_version_id — their version is the persona's. */
async function assertWeightMatrixEditable(supabase: PolicyClient, personaId: string): Promise<{ version: PolicyVersionRow; personaName: string }> {
  const { data } = await supabase.from('personas').select('name, policy_version_id').eq('id', personaId).maybeSingle();
  if (!data) throw new Error('Persona not found.');
  const version = await assertEditableVersion(supabase, data.policy_version_id);
  if (!version) throw new Error('Persona has no policy version.');
  return { version, personaName: data.name };
}

async function parameterName(supabase: PolicyClient, parameterId: string): Promise<string> {
  const { data } = await supabase.from('parameter_definitions').select('name').eq('id', parameterId).maybeSingle();
  return data?.name ?? parameterId;
}

export async function upsertWeightMatrix(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = (formData.get('id') as string) || undefined;
  const personaIdInput = formData.get('persona_id') as string;
  const parameterIdInput = formData.get('parameter_id') as string;
  // 0 is a legitimate weight ("excluded for this persona"). Only a non-number is rejected.
  const weight = parseNumberField(formData.get('weight') as string | null);
  if (weight === undefined) return { ok: false, error: 'Weight must be a number. 0 excludes the parameter for this persona.' };
  if (weight < 0) return { ok: false, error: 'Weight cannot be negative.' };

  return mutate('/policy/weights', async () => {
    const supabase = await createClient();
    if (id) {
      const { data: existing } = await supabase.from('weight_matrices').select('*').eq('id', id).maybeSingle();
      if (!existing) throw new Error('Weight matrix entry not found. Refresh and try again.');
      const { version, personaName } = await assertWeightMatrixEditable(supabase, existing.persona_id);
      const { error } = await supabase.from('weight_matrices').update({ weight }).eq('id', id);
      if (error) throw new Error(error.message);
      const pName = await parameterName(supabase, existing.parameter_id);
      await logAuditEvent({
        event_type: 'weight_matrix_updated',
        actor_id: user.id,
        description: `${versionLabel(version)}: Weight "${pName}" for persona "${personaName}" ${existing.weight}→${weight}.`,
        field_diffs: { before: { weight: existing.weight }, after: { weight } },
        metadata: { policy_version_id: version.id, entity: 'weight_matrix', entity_id: id },
      });
      return `Saved ${pName} weight for ${personaName} to ${versionLabel(version)}.`;
    }

    const { version, personaName } = await assertWeightMatrixEditable(supabase, personaIdInput);
    const { data: duplicate } = await supabase
      .from('weight_matrices')
      .select('id')
      .eq('persona_id', personaIdInput)
      .eq('parameter_id', parameterIdInput)
      .maybeSingle();
    if (duplicate) throw new Error('This persona already has an override for that parameter. Refresh the matrix and edit that cell.');

    const { error } = await supabase.from('weight_matrices').insert({ persona_id: personaIdInput, parameter_id: parameterIdInput, weight });
    if (error) throw new Error(error.message);
    const pName = await parameterName(supabase, parameterIdInput);
    await logAuditEvent({
      event_type: 'weight_matrix_updated',
      actor_id: user.id,
      description: `${versionLabel(version)}: Weight "${pName}" for persona "${personaName}" set to ${weight}.`,
      field_diffs: { after: { weight } },
      metadata: { policy_version_id: version.id, entity: 'weight_matrix', persona_id: personaIdInput, parameter_id: parameterIdInput },
    });
    return `Saved ${pName} weight for ${personaName} to ${versionLabel(version)}.`;
  });
}

export async function deleteWeightMatrix(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const wmId = formData.get('id') as string;
  return mutate('/policy/weights', async () => {
    const supabase = await createClient();
    const { data: existing } = await supabase.from('weight_matrices').select('*').eq('id', wmId).maybeSingle();
    if (!existing) throw new Error('Weight matrix entry not found. Refresh and try again.');
    const { version, personaName } = await assertWeightMatrixEditable(supabase, existing.persona_id);
    const { error } = await supabase.from('weight_matrices').delete().eq('id', wmId);
    if (error) throw new Error(error.message);
    const pName = await parameterName(supabase, existing.parameter_id);
    await logAuditEvent({
      event_type: 'weight_matrix_deleted',
      actor_id: user.id,
      description: `${versionLabel(version)}: Weight override removed for "${pName}" on persona "${personaName}" (was ${existing.weight}).`,
      field_diffs: { before: { weight: existing.weight } },
      metadata: { policy_version_id: version.id, entity: 'weight_matrix', entity_id: wmId },
    });
    return `Removed the ${pName} override for ${personaName}. It now inherits the default.`;
  });
}
