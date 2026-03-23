import { createClient } from './supabase/server';

export type UserRole = 'rm' | 'kam' | 'accounts' | 'bdo' | 'ordinary_approver' | 'board_member' | 'founder_admin';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  branch_id: string | null;
  roles: UserRole[];
}

/**
 * Get the current authenticated user's profile and roles.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const roles = (roleRows || []).map((r: { role: UserRole }) => r.role);

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    branch_id: profile.branch_id,
    roles,
  };
}

/**
 * Check if a user has a specific role.
 */
export function hasRole(user: UserProfile | null, role: UserRole): boolean {
  if (!user) return false;
  return user.roles.includes(role);
}

/**
 * Check if a user has any of the given roles.
 */
export function hasAnyRole(user: UserProfile | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.some(r => user.roles.includes(r));
}

/**
 * Check if the user is a founder/admin.
 */
export function isAdmin(user: UserProfile | null): boolean {
  return hasRole(user, 'founder_admin');
}

/**
 * Log an audit event to the database.
 */
export async function logAuditEvent(params: {
  case_id?: string;
  review_cycle_id?: string;
  event_type: string;
  actor_id?: string;
  description: string;
  field_diffs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  await supabase.from('audit_events').insert({
    case_id: params.case_id,
    review_cycle_id: params.review_cycle_id,
    event_type: params.event_type,
    actor_id: params.actor_id,
    description: params.description,
    field_diffs: params.field_diffs,
    metadata: params.metadata,
  });
}
