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
