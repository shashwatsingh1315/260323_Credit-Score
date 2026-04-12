"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, isAdmin } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

// Called programmatically (can return values)
export async function addRcaReason(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const value = (formData.get('value') as string)?.trim();
  if (!value) return { error: 'Value is required' };

  const supabase = await createClient();
  const { error } = await supabase.from('admin_enumerations').insert({
    category: 'reason_for_credit',
    value,
    is_active: true,
    sort_order: 100,
  });

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { success: true };
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

  const value = (formData.get('value') as string)?.trim();
  if (!value) return { error: 'Value is required' };

  const supabase = await createClient();
  const { error } = await supabase.from('admin_enumerations').insert({
    category: 'delay_reason',
    value,
    is_active: true,
    sort_order: 100,
  });

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { success: true };
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

// Used as form action – must return void
export async function deleteRcaReason(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const id = formData.get('id') as string;
  const supabase = await createClient();
  await supabase.from('admin_enumerations').delete().eq('id', id).eq('category', 'reason_for_credit');
  revalidatePath('/settings');
}

// Used as form action – must return void
export async function deleteDelayReason(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const id = formData.get('id') as string;
  const supabase = await createClient();
  await supabase.from('admin_enumerations').delete().eq('id', id).eq('category', 'delay_reason');
  revalidatePath('/settings');
}

// ID GENERATION LOGIC ACTIONS

export async function addCityCode(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  let code = (formData.get('code') as string)?.trim().toUpperCase();
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
