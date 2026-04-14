'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { USER_ROLES } from '@/utils/auth';

export async function switchImpersonationRole(role: string) {
  if (!USER_ROLES.includes(role as any)) throw new Error("Invalid role");
  const cookieStore = await cookies();
  cookieStore.set('impersonated_role', role, { path: '/' });
  revalidatePath('/', 'layout');
}

export async function getImpersonationRole() {
  const cookieStore = await cookies();
  const cookieRole = cookieStore.get('impersonated_role')?.value;
  
  try {
    const { getCurrentUser } = await import('./auth');
    const user = await getCurrentUser();
    
    if (!user) return 'viewer';

    const requestedRole = cookieRole || user.roles[0] || 'viewer';

    if (user.roles.includes(requestedRole as any) || user.roles.includes('founder_admin')) {
      return requestedRole;
    }
    
    return user.roles[0] || 'viewer';
  } catch (e) {
    return 'viewer';
  }
}

export async function signOut() {
  const { createClient } = await import('@/utils/supabase/server');
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
