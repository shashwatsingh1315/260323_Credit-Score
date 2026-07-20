"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, isAdmin } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

type EnumerationCategory = 'reason_for_credit' | 'delay_reason';
type EnumerationMutationResult = { success: true; reactivated?: boolean } | { error: string };

const normalizeReason = (value: string) => value.trim().replace(/\s+/g, ' ');

async function addEnumeration(category: EnumerationCategory, rawValue: string): Promise<EnumerationMutationResult> {
  const value = normalizeReason(rawValue);
  if (!value) return { error: 'Value is required' };

  const supabase = await createClient();
  const { data: existingRows, error: lookupError } = await supabase
    .from('admin_enumerations')
    .select('id, value, is_active')
    .eq('category', category);

  if (lookupError) return { error: 'Unable to check the existing reasons. Please try again.' };

  const existing = existingRows?.find((row) => normalizeReason(row.value).toLowerCase() === value.toLowerCase());
  if (existing?.is_active) return { error: 'That reason already exists.' };

  if (existing) {
    const { error } = await supabase
      .from('admin_enumerations')
      .update({ value, is_active: true })
      .eq('id', existing.id)
      .eq('category', category);
    if (error) return { error: 'Unable to reactivate that reason. Please try again.' };
    revalidatePath('/settings');
    return { success: true, reactivated: true };
  }

  const { error } = await supabase.from('admin_enumerations').insert({
    category,
    value,
    is_active: true,
    sort_order: 100,
  });

  if (error?.code === '23505') return { error: 'That reason already exists.' };
  if (error) return { error: 'Unable to add the reason. Please try again.' };
  revalidatePath('/settings');
  return { success: true };
}

// Called programmatically (can return values)
export async function addRcaReason(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  return addEnumeration('reason_for_credit', (formData.get('value') as string) || '');
}

// Used as form action – must return void
export async function toggleRcaReason(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const id = formData.get('id') as string;
  const is_active = formData.get('is_active') === 'true';

  const supabase = await createClient();
  await supabase.from('admin_enumerations').update({ is_active }).eq('id', id);
  revalidatePath('/settings');
}

// Called programmatically (can return values)
export async function addDelayReason(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  return addEnumeration('delay_reason', (formData.get('value') as string) || '');
}

// Used as form action – must return void
export async function toggleDelayReason(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const id = formData.get('id') as string;
  const is_active = formData.get('is_active') === 'true';

  const supabase = await createClient();
  await supabase.from('admin_enumerations').update({ is_active }).eq('id', id);
  revalidatePath('/settings');
}

// Called programmatically so the manager can show deletion feedback.
export async function deleteRcaReason(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const id = formData.get('id') as string;
  const supabase = await createClient();
  const { error } = await supabase.from('admin_enumerations').delete().eq('id', id).eq('category', 'reason_for_credit');
  if (error) return { error: 'Unable to delete the reason. Please try again.' };
  revalidatePath('/settings');
  return { success: true };
}

// Called programmatically so the manager can show deletion feedback.
export async function deleteDelayReason(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const id = formData.get('id') as string;
  const supabase = await createClient();
  const { error } = await supabase.from('admin_enumerations').delete().eq('id', id).eq('category', 'delay_reason');
  if (error) return { error: 'Unable to delete the reason. Please try again.' };
  revalidatePath('/settings');
  return { success: true };
}

// ID GENERATION LOGIC ACTIONS

export async function addCityCode(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const code = (formData.get('code') as string)?.trim().toUpperCase();
  const name = (formData.get('name') as string)?.trim();

  if (!code || code.length !== 3) return { error: 'Code must be exactly 3 characters' };
  if (!name) return { error: 'Name is required' };

  const supabase = await createClient();
  const { error } = await supabase.from('city_codes').insert({ code, name });

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { success: true };
}

export async function deleteCityCode(id: string) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const supabase = await createClient();
  const { error } = await supabase.from('city_codes').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { success: true };
}

export async function updateIdPrefix(entity_type: string, prefix: string) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const supabase = await createClient();
  const { error } = await supabase.from('id_prefixes').update({ prefix }).eq('entity_type', entity_type);
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { success: true };
}
