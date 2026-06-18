'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { USER_ROLES } from '@/utils/auth';

export async function switchImpersonationRole(role: string) {
  if (!USER_ROLES.includes(role as any)) throw new Error("Invalid role"); // eslint-disable-line @typescript-eslint/no-explicit-any
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

    // Only allow role impersonation if user is a founder_admin.
    // This ensures a non-founder cannot spoof roles via cookies.
    if (user.roles.includes('founder_admin')) {
      return cookieRole || 'founder_admin';
    }
    
    // Non-founders are restricted to their assigned roles only.
    return user.roles[0] || 'viewer';
  } catch (e) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return 'viewer';
  }
}

export async function signOut() {
  const { createClient } = await import('@/utils/supabase/server');
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
