"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent, isAdmin } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

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
 * Resolve which policy version a /policy screen is operating on.
 * `?v=<id>` selects an explicit version (the only way to see/edit a draft);
 * otherwise the active version. Returns null when neither exists.
 */
export async function resolvePolicyVersion(versionParam?: string) {
  const supabase = await createClient();
  if (versionParam) {
    const { data } = await supabase
      .from('policy_versions')
      .select('*')
      .eq('id', versionParam)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from('policy_versions')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();
  return data;
}

/** Drafts and the active version are editable; archived versions are history
 *  that in-flight/closed cycles still reference — never mutate them. */
async function assertEditableVersion(supabase: any, versionId: string | null | undefined) {
  if (!versionId) return; // creation paths backfill the active version
  const { data } = await supabase
    .from('policy_versions')
    .select('id, is_active, is_draft, version_label')
    .eq('id', versionId)
    .maybeSingle();
  if (!data) throw new Error('Policy version not found.');
  if (!data.is_active && !data.is_draft) {
    throw new Error(`'${data.version_label}' is archived. Archived versions are immutable — create a new draft instead.`);
  }
}

async function assertRowEditable(supabase: any, table: string, id: string) {
  const { data } = await supabase.from(table).select('policy_version_id').eq('id', id).maybeSingle();
  if (!data) throw new Error('Record not found.');
  await assertEditableVersion(supabase, data.policy_version_id);
}

export async function createNewDraft(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

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

    const reparent = (row: any) => {
      const { id, created_at, ...rest } = row;
      return { ...rest, policy_version_id: draft.id };
    };

    // Parameters and personas need id maps so weight matrices can be remapped.
    const paramIdMap = new Map<string, string>();
    const personaIdMap = new Map<string, string>();

    await Promise.all([
      ...(paramsRes.data || []).map(async (p: any) => {
        const { data: inserted, error: insErr } = await supabase
          .from('parameter_definitions').insert(reparent(p)).select('id').single();
        if (insErr) throw new Error(`Clone failed (parameter '${p.name}'): ${insErr.message}`);
        paramIdMap.set(p.id, inserted.id);
      }),
      ...(personasRes.data || []).map(async (p: any) => {
        const { data: inserted, error: insErr } = await supabase
          .from('personas').insert(reparent(p)).select('id').single();
        if (insErr) throw new Error(`Clone failed (persona '${p.name}'): ${insErr.message}`);
        personaIdMap.set(p.id, inserted.id);
      }),
    ]);

    const bulkInserts: PromiseLike<any>[] = [];
    const bulk = (table: string, rows: any[] | null) => {
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
        .filter((w: any) => personaIdMap.has(w.persona_id) && paramIdMap.has(w.parameter_id))
        .map((w: any) => ({
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
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const versionId = formData.get('versionId') as string;
  
  // Archive current active
  await supabase.from('policy_versions').update({ is_active: false, is_draft: false }).eq('is_active', true);
  // Publish new
  await supabase.from('policy_versions').update({
    is_active: true,
    is_draft: false,
    published_at: new Date().toISOString(),
  }).eq('id', versionId);

  // Purge stale preapproved bands; readers will repopulate lazily under the new policy.
  await supabase.rpc('refresh_party_preapproved_bands');

  await logAuditEvent({ event_type: 'policy_published', actor_id: user.id, description: `Policy version ${versionId} published.` });
  revalidatePath('/policy');
}

export async function activateArchivedPolicy(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

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

  await supabase.rpc('refresh_party_preapproved_bands');
  await logAuditEvent({
    event_type: 'policy_reactivated',
    actor_id: user.id,
    description: `Archived policy '${target.version_label}' reactivated${outgoing ? ` in place of '${outgoing.version_label}'` : ''}.`,
  });
  revalidatePath('/policy');
}

export async function discardDraftPolicy(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');
  const versionId = formData.get('versionId') as string;
  const supabase = await createClient();
  const { data: draft } = await supabase.from('policy_versions').select('version_label, is_draft, is_active').eq('id', versionId).maybeSingle();
  if (!draft?.is_draft || draft.is_active) throw new Error('Only an unpublished draft can be discarded.');
  const { error } = await supabase.from('policy_versions').delete().eq('id', versionId).eq('is_draft', true).eq('is_active', false);
  if (error) throw new Error(error.message);
  await logAuditEvent({ event_type: 'policy_draft_discarded', actor_id: user.id, description: `Draft policy '${draft.version_label}' discarded. Child configuration was removed by cascade.` });
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
      .single();
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

export async function upsertParameter(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const payload: any = {
    name: formData.get('parameter_name') as string,
    subject_type: formData.get('applies_to_subject') as string,
    stage: parseInt(formData.get('stage') as string) || 1,
    default_owning_role: formData.get('default_owning_role') as string || 'rm',
    input_type: formData.get('data_type') as string || 'grade_select',
    weight: parseFloat(formData.get('weight') as string) || 1.0,
    rubric_guidance: formData.get('description') as string || '',
    signal_strength: formData.get('signal_strength') as string || '3',
    signal_cost: formData.get('signal_cost') as string || '3',
    signal_lag: formData.get('signal_lag') as string || 'Leading',
    sla_days: parseInt(formData.get('sla_days') as string) || null,
    require_reasoning: formData.get('require_reasoning') === 'true',
    is_critical: formData.get('is_critical') === 'true',
    is_stable: formData.get('is_stable') === 'true',
    persistence_scope: formData.get('persistence_scope') as string || 'none',
  };

  const policyVersionId = formData.get('policy_version_id') as string;
  if (policyVersionId) {
    payload.policy_version_id = policyVersionId;
  }

  const autoBandConfigStr = formData.get('auto_band_config') as string;
  if (autoBandConfigStr) {
    try {
      payload.auto_band_config = JSON.parse(autoBandConfigStr);
    } catch (e) {
      console.error('Invalid auto_band_config JSON', e);
    }
  } else {
    payload.auto_band_config = null;
  }

  if (payload.input_type === 'yes_no') {
    const mappings = payload.auto_band_config?.mappings;
    const values = new Set((mappings || []).map((mapping: any) => String(mapping.value).toLowerCase()));
    if (!values.has('yes') || !values.has('no')) {
      throw new Error('Yes/No parameters require both Yes and No grade mappings.');
    }
  }

  if (id) {
    await assertRowEditable(supabase, 'parameter_definitions', id);
    delete payload.policy_version_id; // parameters never move between versions
    await supabase.from('parameter_definitions').update(payload).eq('id', id);
  } else {
    await assertEditableVersion(supabase, payload.policy_version_id);
    if (!payload.policy_version_id) {
      const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).single();
      if (activePolicy) {
        payload.policy_version_id = activePolicy.id;
      } else {
        throw new Error('No active policy found to attach this parameter to.');
      }
    }
    await supabase.from('parameter_definitions').insert(payload);
  }
  await logAuditEvent({ event_type: 'parameter_updated', actor_id: user.id, description: `Parameter '${payload.name}' saved.` });
  revalidatePath('/policy/parameters');
}

export async function deleteParameter(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string;
  await assertRowEditable(supabase, 'parameter_definitions', id);
  await supabase.from('parameter_definitions').update({ is_active: false }).eq('id', id);
  await logAuditEvent({ event_type: 'parameter_deleted', actor_id: user.id, description: `Parameter ${id} archived.` });
  revalidatePath('/policy/parameters');
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

export async function upsertGradeDefinition(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const payload: any = {
    grade_label: formData.get('grade_label') as string,
    grade_value: parseInt(formData.get('grade_value') as string) || 0,
    description: formData.get('description') as string || '',
    policy_version_id: formData.get('policy_version_id') as string || null,
  };
  if (id) {
    await assertRowEditable(supabase, 'grade_scale', id);
    delete payload.policy_version_id;
    await supabase.from('grade_scale').update(payload).eq('id', id);
  } else {
    await assertEditableVersion(supabase, payload.policy_version_id);
    if (!payload.policy_version_id) {
      const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).single();
      if (activePolicy) {
        payload.policy_version_id = activePolicy.id;
      } else {
        throw new Error('No active policy found to attach this grade to.');
      }
    }
    await supabase.from('grade_scale').insert(payload);
  }
  await logAuditEvent({ event_type: 'grade_definition_updated', actor_id: user.id, description: `Grade ${payload.grade_value} definition updated.` });
  revalidatePath('/policy/grades');
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

export async function upsertScoreBand(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const payload: any = {
    band_name: formData.get('band_name') as string,
    min_score: parseFloat(formData.get('min_score') as string),
    max_score: parseFloat(formData.get('max_score') as string),
    approved_credit_days: parseInt(formData.get('approved_credit_days') as string),
    is_ambiguity_band: formData.get('is_ambiguity_band') === 'true',
    policy_version_id: formData.get('policy_version_id') as string || null,
  };

  if (payload.min_score > payload.max_score) {
    throw new Error('Min score cannot be greater than max score');
  }

  if (id) {
    await assertRowEditable(supabase, 'score_bands', id);
    delete payload.policy_version_id;
    await supabase.from('score_bands').update(payload).eq('id', id);
  } else {
    await assertEditableVersion(supabase, payload.policy_version_id);
    if (!payload.policy_version_id) {
      const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).single();
      if (activePolicy) {
        payload.policy_version_id = activePolicy.id;
      } else {
        throw new Error('No active policy found to attach this score band to.');
      }
    }
    await supabase.from('score_bands').insert(payload);
  }
  await logAuditEvent({ event_type: 'score_band_updated', actor_id: user.id, description: `Band '${payload.band_name}' saved.` });
  revalidatePath('/policy/bands');
}

export async function deleteScoreBand(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  await assertRowEditable(supabase, 'score_bands', formData.get('id') as string);
  await supabase.from('score_bands').delete().eq('id', formData.get('id') as string);
  revalidatePath('/policy/bands');
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

export async function upsertPersona(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const payload: any = {
    name: formData.get('persona_name') as string,
    description: formData.get('description') as string || '',
    minimum_score: formData.get('minimum_score_enabled') === 'true'
      ? parseFloat(formData.get('minimum_score') as string)
      : null,
    policy_version_id: formData.get('policy_version_id') as string || null,
  };
  if (id) {
    await assertRowEditable(supabase, 'personas', id);
    delete payload.policy_version_id;
    await supabase.from('personas').update(payload).eq('id', id);
  } else {
    await assertEditableVersion(supabase, payload.policy_version_id);
    if (!payload.policy_version_id) {
      const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).single();
      if (activePolicy) {
        payload.policy_version_id = activePolicy.id;
      } else {
        throw new Error('No active policy found to attach this persona to.');
      }
    }
    await supabase.from('personas').insert(payload);
  }
  await logAuditEvent({ event_type: 'persona_updated', actor_id: user.id, description: `Persona '${payload.name}' saved.` });
  revalidatePath('/policy/personas');
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

export async function upsertDominanceCategory(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const payload: any = {
    name: formData.get('name') as string,
    customer_weight: parseFloat(formData.get('customer_weight') as string) || 0.5,
    contractor_weight: parseFloat(formData.get('contractor_weight') as string) || 0.5,
    combination_method: formData.get('combination_method') as string || 'weighted',
    exponent: parseFloat(formData.get('exponent') as string) || 1.0,
    policy_version_id: formData.get('policy_version_id') as string || null,
  };

  if (id) {
    await assertRowEditable(supabase, 'dominance_categories', id);
    delete payload.policy_version_id;
    await supabase.from('dominance_categories').update(payload).eq('id', id);
  } else {
    await assertEditableVersion(supabase, payload.policy_version_id);
    if (!payload.policy_version_id) {
      const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).single();
      if (activePolicy) {
        payload.policy_version_id = activePolicy.id;
      } else {
        throw new Error('No active policy found to attach this dominance category to.');
      }
    }
    await supabase.from('dominance_categories').insert(payload);
  }
  await logAuditEvent({ event_type: 'dominance_category_updated', actor_id: user.id, description: `Dominance Category '${payload.name}' saved.` });
  revalidatePath('/policy/dominance');
}

export async function deleteDominanceCategory(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  await assertRowEditable(supabase, 'dominance_categories', formData.get('id') as string);
  await supabase.from('dominance_categories').delete().eq('id', formData.get('id') as string);
  revalidatePath('/policy/dominance');
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

export async function upsertRoutingRule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  
  let context_rule = {};
  try {
    context_rule = JSON.parse(formData.get('context_rule') as string || '{}');
  } catch (e) {
    throw new Error('Invalid JSON in context rule');
  }
  
  const target_stage = parseInt(formData.get('target_stage') as string) || 1;
  let policy_version_id = formData.get('policy_version_id') as string || null;

  if (!policy_version_id && !id) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).single();
    policy_version_id = activePolicy?.id || null;
  }

  if (id) {
    await assertRowEditable(supabase, 'routing_thresholds', id);
    await supabase.from('routing_thresholds').update({ context_rule, target_stage }).eq('id', id);
  } else {
    await assertEditableVersion(supabase, policy_version_id);
    await supabase.from('routing_thresholds').insert({ context_rule, target_stage, policy_version_id });
  }
  await logAuditEvent({ event_type: 'routing_rule_updated', actor_id: user.id, description: `Routing rule saved.` });
  revalidatePath('/policy/routing');
}

export async function deleteRoutingRule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  await assertRowEditable(supabase, 'routing_thresholds', formData.get('id') as string);
  await supabase.from('routing_thresholds').delete().eq('id', formData.get('id') as string);
  revalidatePath('/policy/routing');
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

export async function upsertValidityRule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  
  let context_rule = {};
  try {
    context_rule = JSON.parse(formData.get('context_rule') as string || '{}');
  } catch (e) {
    throw new Error('Invalid JSON in context rule');
  }

  const validity_days = parseInt(formData.get('validity_days') as string) || 90;
  let policy_version_id = formData.get('policy_version_id') as string || null;

  if (!policy_version_id && !id) {
    const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).single();
    policy_version_id = activePolicy?.id || null;
  }

  if (id) {
    await assertRowEditable(supabase, 'validity_rules', id);
    await supabase.from('validity_rules').update({ context_rule, validity_days }).eq('id', id);
  } else {
    await assertEditableVersion(supabase, policy_version_id);
    await supabase.from('validity_rules').insert({ context_rule, validity_days, policy_version_id });
  }
  revalidatePath('/policy/validity');
}

export async function deleteValidityRule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  await assertRowEditable(supabase, 'validity_rules', formData.get('id') as string);
  await supabase.from('validity_rules').delete().eq('id', formData.get('id') as string);
  revalidatePath('/policy/validity');
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

export async function upsertStageMaxTotal(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const stage = parseInt(formData.get('stage') as string);
  const max_total = parseFloat(formData.get('max_total') as string);
  let policy_version_id = formData.get('policy_version_id') as string || null;

  if (id) {
    await assertRowEditable(supabase, 'stage_max_totals', id);
    await supabase.from('stage_max_totals').update({ max_total }).eq('id', id);
  } else {
    if (!policy_version_id) {
      const { data: activePolicy } = await supabase.from('policy_versions').select('id').eq('is_active', true).single();
      if (!activePolicy) throw new Error('No active policy found to attach this stage max total to.');
      policy_version_id = activePolicy.id;
    }
    await assertEditableVersion(supabase, policy_version_id);
    await supabase.from('stage_max_totals').insert({ stage, max_total, policy_version_id });
  }
  await logAuditEvent({ event_type: 'stage_max_total_updated', actor_id: user.id, description: `Stage ${stage} max total set to ${max_total}.` });
  revalidatePath('/policy/stages');
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
async function assertWeightMatrixEditable(supabase: any, personaId: string) {
  const { data } = await supabase.from('personas').select('policy_version_id').eq('id', personaId).maybeSingle();
  if (!data) throw new Error('Persona not found.');
  await assertEditableVersion(supabase, data.policy_version_id);
}

export async function upsertWeightMatrix(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const persona_id = formData.get('persona_id') as string;
  const parameter_id = formData.get('parameter_id') as string;
  const weightRaw = parseFloat(formData.get('weight') as string);
  // 0 is a legitimate weight ("excluded for this persona") — only NaN falls back
  const weight = Number.isNaN(weightRaw) ? 1.0 : weightRaw;

  if (id) {
    const { data: existing } = await supabase.from('weight_matrices').select('persona_id').eq('id', id).maybeSingle();
    if (!existing) throw new Error('Weight matrix entry not found.');
    await assertWeightMatrixEditable(supabase, existing.persona_id);
    await supabase.from('weight_matrices').update({ weight }).eq('id', id);
  } else {
    await assertWeightMatrixEditable(supabase, persona_id);
    await supabase.from('weight_matrices').insert({ persona_id, parameter_id, weight });
  }
  await logAuditEvent({ event_type: 'weight_matrix_updated', actor_id: user.id, description: `Weight matrix updated.` });
  revalidatePath('/policy/weights');
}

export async function deleteWeightMatrix(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can manage policy');

  const supabase = await createClient();
  const wmId = formData.get('id') as string;
  const { data: existing } = await supabase.from('weight_matrices').select('persona_id').eq('id', wmId).maybeSingle();
  if (!existing) throw new Error('Weight matrix entry not found.');
  await assertWeightMatrixEditable(supabase, existing.persona_id);
  await supabase.from('weight_matrices').delete().eq('id', wmId);
  revalidatePath('/policy/weights');
}
