'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { USER_ROLES } from '@/utils/auth';

export async function switchImpersonationRole(role: string) {
  if (!USER_ROLES.includes(role as any)) throw new Error("Invalid role");

  const { getCurrentUser, isAdmin } = await import('./auth');
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) throw new Error("Only admins can impersonate roles");

  const cookieStore = await cookies();
  cookieStore.set('impersonated_role', role, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  revalidatePath('/', 'layout');
}

export async function getImpersonationRole() {
  const cookieStore = await cookies();
  const cookieRole = cookieStore.get('impersonated_role')?.value;
  
  try {
    const { getCurrentUser } = await import('./auth');
    const user = await getCurrentUser();
    
    if (!user) return 'viewer';

    if (cookieRole && user.roles.includes('founder_admin')) {
      return cookieRole;
    }
    
    return user.roles[0] || 'viewer';
  } catch {
    return 'viewer';
  }
}

export async function signOut() {
  const { createClient } = await import('@/utils/supabase/server');
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
