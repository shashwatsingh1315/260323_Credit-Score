"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent } from '@/utils/auth';
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

export async function createNewDraft(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  
  // Calculate next version label based on count
  const { count } = await supabase.from('policy_versions').select('*', { count: 'exact', head: true });
  const nextVersion = (count || 0) + 1;
  
  const { data, error } = await supabase.from('policy_versions').insert({
    version_label: (formData.get('label') as string) || `v${nextVersion}.0 Draft`,
    is_draft: true,
    is_active: false,
    created_by: user.id,
  }).select().single();
  
  if (error) throw new Error(error.message);
  await logAuditEvent({ event_type: 'policy_draft_created', actor_id: user.id, description: `Draft policy v${nextVersion}.0 created.` });
  revalidatePath('/policy');
}

export async function publishDraftPolicy(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
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
  
  await logAuditEvent({ event_type: 'policy_published', actor_id: user.id, description: `Policy version ${versionId} published.` });
  revalidatePath('/policy');
}

// ── Scoring Parameters ──────────────────────────────────────────────────────

export async function fetchParameters() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('parameter_definitions')
    .select('*')
    .order('name');
  return data || [];
}

export async function upsertParameter(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
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
    policy_version_id: formData.get('policy_version_id') as string || null,
    signal_strength: formData.get('signal_strength') as string || '3',
    signal_cost: formData.get('signal_cost') as string || '3',
    signal_lag: formData.get('signal_lag') as string || 'Leading',
  };
  if (id) {
    await supabase.from('parameter_definitions').update(payload).eq('id', id);
  } else {
    await supabase.from('parameter_definitions').insert(payload);
  }
  await logAuditEvent({ event_type: 'parameter_updated', actor_id: user.id, description: `Parameter '${payload.name}' saved.` });
  revalidatePath('/policy/parameters');
}

export async function deleteParameter(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const id = formData.get('id') as string;
  await supabase.from('parameter_definitions').update({ is_active: false }).eq('id', id);
  await logAuditEvent({ event_type: 'parameter_deleted', actor_id: user.id, description: `Parameter ${id} archived.` });
  revalidatePath('/policy/parameters');
}

// ── Grade Scales ────────────────────────────────────────────────────────────

export async function fetchGradeScales() {
  const supabase = await createClient();
  // Schema now consolidates grades into the grade_scale table
  const { data } = await supabase.from('grade_scale').select('*').order('min_score', { ascending: false });
  return data || [];
}

export async function upsertGradeDefinition(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const payload: any = {
    grade_label: formData.get('grade_label') as string,
    min_score: parseFloat(formData.get('min_score') as string),
    max_score: parseFloat(formData.get('max_score') as string),
    description: formData.get('description') as string || '',
    numeric_value: parseFloat(formData.get('numeric_value') as string) || 0,
    policy_version_id: formData.get('policy_version_id') as string || null,
  };
  if (id) {
    await supabase.from('grade_scale').update(payload).eq('id', id);
  } else {
    await supabase.from('grade_scale').insert(payload);
  }
  revalidatePath('/policy/grades');
}

// ── Score Bands ─────────────────────────────────────────────────────────────

export async function fetchScoreBands() {
  const supabase = await createClient();
  const { data } = await supabase.from('score_bands').select('*').order('min_score', { ascending: false });
  return data || [];
}

export async function upsertScoreBand(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const payload: any = {
    band_name: formData.get('band_name') as string,
    min_score: parseFloat(formData.get('min_score') as string),
    max_score: parseFloat(formData.get('max_score') as string),
    approved_credit_days: parseInt(formData.get('approved_credit_days') as string),
    color_hex: formData.get('color_hex') as string || '#6366f1',
    policy_version_id: formData.get('policy_version_id') as string || null,
  };
  if (id) {
    await supabase.from('score_bands').update(payload).eq('id', id);
  } else {
    await supabase.from('score_bands').insert(payload);
  }
  await logAuditEvent({ event_type: 'score_band_updated', actor_id: user.id, description: `Band '${payload.band_name}' saved.` });
  revalidatePath('/policy/bands');
}

export async function deleteScoreBand(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  await supabase.from('score_bands').delete().eq('id', formData.get('id') as string);
  revalidatePath('/policy/bands');
}

// ── Persona Definitions ──────────────────────────────────────────────────────

export async function fetchPersonas() {
  const supabase = await createClient();
  const { data } = await supabase.from('personas').select('*').order('name');
  return data || [];
}

export async function upsertPersona(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const payload: any = {
    name: formData.get('persona_name') as string,
    description: formData.get('description') as string || '',
    minimum_score: parseFloat(formData.get('minimum_score') as string) || 0,
    policy_version_id: formData.get('policy_version_id') as string || null,
  };
  if (id) {
    await supabase.from('personas').update(payload).eq('id', id);
  } else {
    await supabase.from('personas').insert(payload);
  }
  revalidatePath('/policy/personas');
}

// ── Dominance Categories ─────────────────────────────────────────────────────

export async function fetchDominanceCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from('dominance_categories').select('*').order('name');
  return data || [];
}

export async function upsertDominanceCategory(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
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
    await supabase.from('dominance_categories').update(payload).eq('id', id);
  } else {
    await supabase.from('dominance_categories').insert(payload);
  }
  revalidatePath('/policy/dominance');
}

export async function deleteDominanceCategory(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  await supabase.from('dominance_categories').delete().eq('id', formData.get('id') as string);
  revalidatePath('/policy/dominance');
}

// ── Routing & Validity Rules ────────────────────────────────────────────────

export async function fetchRoutingRules() {
  const supabase = await createClient();
  const { data } = await supabase.from('routing_thresholds').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function upsertRoutingRule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const context_rule = JSON.parse(formData.get('context_rule') as string || '{}');
  const target_stage = parseInt(formData.get('target_stage') as string) || 1;
  const policy_version_id = formData.get('policy_version_id') as string || null;

  if (id) {
    await supabase.from('routing_thresholds').update({ context_rule, target_stage }).eq('id', id);
  } else {
    await supabase.from('routing_thresholds').insert({ context_rule, target_stage, policy_version_id });
  }
  revalidatePath('/policy/routing');
}

export async function deleteRoutingRule(formData: FormData) {
  const supabase = await createClient();
  await supabase.from('routing_thresholds').delete().eq('id', formData.get('id') as string);
  revalidatePath('/policy/routing');
}

export async function fetchValidityRules() {
  const supabase = await createClient();
  const { data } = await supabase.from('validity_rules').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function upsertValidityRule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const context_rule = JSON.parse(formData.get('context_rule') as string || '{}');
  const validity_days = parseInt(formData.get('validity_days') as string) || 90;
  const policy_version_id = formData.get('policy_version_id') as string || null;

  if (id) {
    await supabase.from('validity_rules').update({ context_rule, validity_days }).eq('id', id);
  } else {
    await supabase.from('validity_rules').insert({ context_rule, validity_days, policy_version_id });
  }
  revalidatePath('/policy/validity');
}

export async function deleteValidityRule(formData: FormData) {
  const supabase = await createClient();
  await supabase.from('validity_rules').delete().eq('id', formData.get('id') as string);
  revalidatePath('/policy/validity');
}

// ── Stage Max Totals ────────────────────────────────────────────────────────

export async function fetchStageMaxTotals() {
  const supabase = await createClient();
  const { data } = await supabase.from('stage_max_totals').select('*').order('stage');
  return data || [];
}

export async function upsertStageMaxTotal(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const stage = parseInt(formData.get('stage') as string);
  const max_total = parseFloat(formData.get('max_total') as string);
  const policy_version_id = formData.get('policy_version_id') as string || null;

  if (id) {
    await supabase.from('stage_max_totals').update({ max_total }).eq('id', id);
  } else {
    await supabase.from('stage_max_totals').insert({ stage, max_total, policy_version_id });
  }
  revalidatePath('/policy/stages');
}

// ── Weight Matrices ─────────────────────────────────────────────────────────

export async function fetchWeightMatrices() {
  const supabase = await createClient();
  const { data } = await supabase.from('weight_matrices').select(`
    *,
    persona:personas(name),
    parameter:parameter_definitions(name, stage)
  `);
  return data || [];
}

export async function upsertWeightMatrix(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const persona_id = formData.get('persona_id') as string;
  const parameter_id = formData.get('parameter_id') as string;
  const weight = parseFloat(formData.get('weight') as string) || 1.0;

  if (id) {
    await supabase.from('weight_matrices').update({ weight }).eq('id', id);
  } else {
    await supabase.from('weight_matrices').insert({ persona_id, parameter_id, weight });
  }
  revalidatePath('/policy/weights');
}

export async function deleteWeightMatrix(formData: FormData) {
  const supabase = await createClient();
  await supabase.from('weight_matrices').delete().eq('id', formData.get('id') as string);
  revalidatePath('/policy/weights');
}
