'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function switchImpersonationRole(role: string) {
  const cookieStore = await cookies();
  cookieStore.set('impersonated_role', role, { path: '/' });
  revalidatePath('/', 'layout');
}

export async function getImpersonationRole() {
  const cookieStore = await cookies();
  const requestedRole = cookieStore.get('impersonated_role')?.value || 'founder_admin';
  
  try {
    const { getCurrentUser } = await import('./auth');
    const user = await getCurrentUser();
    if (user && (user.roles.includes(requestedRole as any) || user.roles.includes('founder_admin'))) {
      return requestedRole;
    }
    // Fallback securely to their actual primary role
    return user?.roles?.[0] || 'founder_admin';
  } catch (e) {
    return 'founder_admin';
  }
}

export async function signOut() {
  const { createClient } = await import('@/utils/supabase/server');
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
