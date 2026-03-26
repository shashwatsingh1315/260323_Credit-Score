"use server";
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function switchImpersonationRole(role: string) {
  const cookieStore = await cookies();
  cookieStore.set('impersonated_role', role, { path: '/' });
  revalidatePath('/', 'layout');
}

export async function getImpersonationRole() {
  const cookieStore = await cookies();
  return cookieStore.get('impersonated_role')?.value || 'founder_admin';
}
