'use server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCurrentUser, logAuditEvent, hasAnyRole, isAdmin } from '@/utils/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { refreshPreapprovedBand } from '@/utils/preapproval';

/** Service-role client for authoritative admin reads and deletes (bypasses RLS). */
function serviceClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server misconfiguration: Missing Supabase Admin credentials');
  }
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function fetchParties(search?: string) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error('Only Admin can view the party master');

  const supabase = await createClient({ next: { tags: ['parties'] } });
  let query = supabase.from('parties').select('id, legal_name, display_name, customer_code, industry_category, party_type, influencer_subtype, address, is_active, gst_number, pan_number').order('legal_name').limit(1000);
  if (search) query = query.ilike('legal_name', `%${search}%`);
  const { data, error } = await query;
  return { data: data || [], error: error ? 'Unable to load parties.' : null };
}

export async function upsertParty(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyRole(user, ['rm', 'kam', 'founder_admin'])) {
      return { success: false, error: 'Unauthorized. Only RM, KAM or Admin can manage parties' };
    }
    const supabase = await createClient();
    const id = formData.get('id') as string || undefined;
    const payload: any = {
      legal_name: formData.get('legal_name') as string,
      customer_code: formData.get('customer_code') as string,
      party_type: formData.get('party_type') as string || 'both',
      influencer_subtype: formData.get('influencer_subtype') as string || null,
      gst_number: formData.get('gstin') as string || null,
      pan_number: formData.get('pan') as string || null,
      contact_phone: formData.get('contact_phone') as string || null,
      display_name: formData.get('nickname') as string || null,
      address: [formData.get('city'), formData.get('state')].filter(Boolean).join(', ') || null,
      industry_category: formData.get('industry_sector') as string || null,
      is_active: true,
    };
    if (id) {
      await supabase.from('parties').update(payload).eq('id', id);
    } else {
      const { data, error } = await supabase.from('parties').insert(payload).select('id, legal_name, customer_code').single();
      if (error) throw error;
      await logAuditEvent({ event_type: 'party_upserted', actor_id: user.id, description: `Party '${payload.legal_name}' saved.` });
      revalidatePath('/admin');
      return { success: true, party: data };
    }
    await logAuditEvent({ event_type: 'party_upserted', actor_id: user.id, description: `Party '${payload.legal_name}' saved.` });
    revalidatePath('/admin');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Soft-deactivates a party (is_active = false). Returns a result so the UI can report it. */
export async function deactivateParty(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!isAdmin(user)) return { success: false, error: 'Only Admin can deactivate parties' };

    const id = formData.get('id') as string;
    if (!id) return { success: false, error: 'Missing party ID' };

    const supabase = await createClient();
    const { error } = await supabase.from('parties').update({ is_active: false }).eq('id', id);
    if (error) return { success: false, error: 'Unable to deactivate this party. Please try again.' };

    await logAuditEvent({ event_type: 'party_deactivated', actor_id: user.id, description: `Party ${id} deactivated.` });
    revalidatePath('/admin');
    return { success: true };
  } catch {
    return { success: false, error: 'Unable to deactivate this party. Please try again.' };
  }
}

export async function reactivateParty(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!isAdmin(user)) return { success: false, error: 'Only Admin can reactivate parties' };

    const id = formData.get('id') as string;
    if (!id) return { success: false, error: 'Missing party ID' };

    const supabase = await createClient();
    const { error } = await supabase.from('parties').update({ is_active: true }).eq('id', id);
    if (error) return { success: false, error: 'Unable to reactivate this party. Please try again.' };

    await logAuditEvent({ event_type: 'party_reactivated', actor_id: user.id, description: `Party ${id} reactivated.` });
    revalidatePath('/admin');
    return { success: true };
  } catch {
    return { success: false, error: 'Unable to reactivate this party. Please try again.' };
  }
}

export async function fetchAllUsers() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return { success: false, error: 'Forbidden' };
  const supabase = await createClient({ next: { tags: ['users'] } });
  const { data } = await supabase
    .from('profiles')
    .select('*, roles:user_roles(role)')
    .order('full_name');
  return data || [];
}

export async function assignRole(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!isAdmin(user)) return { success: false, error: 'Unauthorized. Only Admin can assign roles' };
    const supabase = await createClient();
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;
    await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
    await logAuditEvent({ event_type: 'role_assigned', actor_id: user.id, description: `Role '${role}' assigned to ${userId}.` });
    revalidatePath('/admin');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function revokeRole(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!isAdmin(user)) return { success: false, error: 'Unauthorized. Only Admin can revoke roles' };
    const supabase = await createClient();
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;

    // Guard: the platform must always keep at least one Founder Admin.
    if (role === 'founder_admin') {
      const { data: founders, error: foundersErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'founder_admin');
      if (foundersErr) return { success: false, error: 'Unable to verify Founder Admins. Please try again.' };
      const holdsRole = (founders || []).some((f: { user_id: string }) => f.user_id === userId);
      if (holdsRole && (founders || []).length <= 1) {
        return { success: false, error: 'This is the last Founder Admin. Assign the role to another user before removing it.' };
      }
    }

    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
    if (error) return { success: false, error: 'Unable to revoke this role. Please try again.' };

    await logAuditEvent({ event_type: 'role_revoked', actor_id: user.id, description: `Role '${role}' revoked from ${userId}.` });
    revalidatePath('/admin');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function fetchGlobalAuditLog(limit = 100) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error('Only Admin can view the global audit log');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_events')
    .select('*, actor:profiles!audit_events_actor_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data || [], error: error ? 'Unable to load the audit log.' : null };
}

export async function adminCreateUser(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!isAdmin(user)) return { success: false, error: 'Unauthorized' };

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('full_name') as string;
    const role = formData.get('role') as string;

    if (!email || !password || !fullName || !role) {
      throw new Error('Missing required fields');
    }

    const supabaseAdmin = serviceClient();

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (createError) throw new Error(createError.message);

    const newUserId = authData.user.id;

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: newUserId,
      full_name: fullName,
      email: email
    });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      throw new Error(`Profile creation error: ${profileError.message}`);
    }

    const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({
      user_id: newUserId,
      role: role
    });

    if (roleError) {
      console.error("Role creation error:", roleError);
      throw new Error(`Role creation error: ${roleError.message}`);
    }

    await logAuditEvent({ event_type: 'user_created', actor_id: user.id, description: `Created new user ${email} with role ${role}` });
    revalidatePath('/admin');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

type UserReferenceCounts = { ownedCases: number; tasks: number; auditRecords: number };

/**
 * Counts the records that reference a user. Any of these blocks a hard delete (FKs without ON DELETE).
 * Returns null when any count query fails, so callers treat the references as unknown rather than zero.
 */
async function countUserReferences(
  admin: ReturnType<typeof serviceClient>,
  userId: string,
): Promise<UserReferenceCounts | null> {
  const [cases, tasks, audit] = await Promise.all([
    admin.from('credit_cases').select('id', { count: 'exact', head: true })
      .or(`rm_user_id.eq.${userId},kam_user_id.eq.${userId}`),
    admin.from('stage_tasks').select('id', { count: 'exact', head: true })
      .or(`assigned_to.eq.${userId},completed_by.eq.${userId}`),
    admin.from('audit_events').select('id', { count: 'exact', head: true })
      .eq('actor_id', userId),
  ]);
  if (cases.error || tasks.error || audit.error) return null;
  return {
    ownedCases: cases.count ?? 0,
    tasks: tasks.count ?? 0,
    auditRecords: audit.count ?? 0,
  };
}

/** Consequence preview for the delete-user dialog. */
export async function fetchUserDeletionImpact(userId: string) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return { success: false as const, error: 'Forbidden' };

  if (userId === user!.id) {
    return { success: true as const, impact: { isSelf: true, ownedCases: 0, tasks: 0, auditRecords: 0, onRoster: false } };
  }

  const admin = serviceClient();
  const [counts, roster] = await Promise.all([
    countUserReferences(admin, userId),
    admin.from('committee_rosters').select('member_ids').eq('is_active', true).limit(1).maybeSingle(),
  ]);
  if (!counts) return { success: false as const, error: 'Unable to check linked records. Please try again.' };
  const memberIds: string[] = (roster.data?.member_ids as string[] | null) ?? [];

  return {
    success: true as const,
    impact: { isSelf: false, ...counts, onRoster: memberIds.includes(userId) },
  };
}

export async function adminDeleteUser(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!isAdmin(user)) return { success: false, error: 'Unauthorized' };

    const targetUserId = formData.get('userId') as string;
    if (!targetUserId) throw new Error('Missing user ID');
    if (targetUserId === user.id) return { success: false, error: 'You cannot delete your own account.' };

    const admin = serviceClient();

    // Require the exact email to be typed (the dialog collects it as confirmText).
    const { data: target } = await admin.from('profiles').select('email').eq('id', targetUserId).maybeSingle();
    if (!target) return { success: false, error: 'User not found.' };
    const confirmText = ((formData.get('confirmText') as string) || '').trim().toLowerCase();
    if (confirmText !== String(target.email || '').toLowerCase()) {
      return { success: false, error: 'Type the user’s email address exactly to confirm deletion.' };
    }

    // Preflight: the database blocks deletes for referenced users. Say so plainly instead of a raw DB error.
    // If the count fails, references are unknown: fall through so deleteUser's own FK guard decides.
    const counts = await countUserReferences(admin, targetUserId);
    if (counts && counts.ownedCases + counts.tasks + counts.auditRecords > 0) {
      return {
        success: false,
        error: `This user is linked to ${counts.ownedCases} case(s), ${counts.tasks} task(s) (assigned or completed) and ${counts.auditRecords} audit record(s), so the account cannot be deleted without losing history. Revoke their roles to remove access instead.`,
      };
    }

    const { error } = await admin.auth.admin.deleteUser(targetUserId);
    if (error) {
      return { success: false, error: 'This account could not be deleted. Revoke its roles to remove access instead.' };
    }

    await logAuditEvent({ event_type: 'user_deleted', actor_id: user.id, description: `Deleted user ${targetUserId}` });
    revalidatePath('/admin');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function fetchActiveRoster() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error('Only Admin can view the committee roster');

  const supabase = await createClient();
  const { data } = await supabase
    .from('committee_rosters')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data;
}

export async function updateCommitteeRoster(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) return { success: false, error: 'Unauthorized' };

    const supabase = await createClient();
    const memberIdsRaw = formData.get('memberIds') as string;
    const memberIds = JSON.parse(memberIdsRaw);

    // Get current roster to see if we update or insert
    const { data: existing } = await supabase.from('committee_rosters').select('id').eq('is_active', true).limit(1).maybeSingle();

    if (existing) {
      await supabase.from('committee_rosters')
        .update({ member_ids: memberIds, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('committee_rosters').insert({
        name: 'Default Board',
        member_ids: memberIds,
        is_active: true
      });
    }

    await logAuditEvent({
      event_type: 'roster_updated',
      actor_id: user.id,
      description: `Committee roster updated with ${memberIds.length} members.`
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Recomputes party_history metrics from realized_outcomes for all parties
 * that have at least one closed case in the system.
 * Should be run by admin after a batch of case closures.
 */
export async function recomputePartyHistoryFromOutcomes() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can recompute party history.');

  const supabase = await createClient();

  // Fetch all realized outcomes joined to their cases
  const { data: outcomes } = await supabase
    .from('realized_outcomes')
    .select(`
      realized_delay_days,
      realized_exposure,
      deal_happened,
      case:credit_cases!realized_outcomes_case_id_fkey(
        customer_party_id, contractor_party_id, decided_bill_amount
      )
    `);

  if (!outcomes || outcomes.length === 0) return { updated: 0 };

  // Aggregate per party
  const partyStats: Record<string, {
    orderCount: number;
    totalVolume: number;
    delayDays: number[];
    maxDelay: number;
  }> = {};

  for (const o of outcomes) {
    if (!o.deal_happened) continue;
    const c = o.case as any;
    const parties = [c?.customer_party_id, c?.contractor_party_id].filter(Boolean);
    for (const partyId of parties) {
      if (!partyStats[partyId]) {
        partyStats[partyId] = { orderCount: 0, totalVolume: 0, delayDays: [], maxDelay: 0 };
      }
      partyStats[partyId].orderCount++;
      partyStats[partyId].totalVolume += c?.decided_bill_amount ?? 0;
      if (o.realized_delay_days != null) {
        partyStats[partyId].delayDays.push(o.realized_delay_days);
        partyStats[partyId].maxDelay = Math.max(partyStats[partyId].maxDelay, o.realized_delay_days);
      }
    }
  }

  let updated = 0;
  for (const [partyId, stats] of Object.entries(partyStats)) {
    const avgDelay = stats.delayDays.length > 0
      ? stats.delayDays.reduce((a, b) => a + b, 0) / stats.delayDays.length
      : 0;

    await supabase.from('party_history').upsert({
      party_id: partyId,
      import_job_id: null,
      order_count: stats.orderCount,
      total_volume: stats.totalVolume,
      average_delay_days: Math.round(avgDelay * 10) / 10,
      max_delay_days: stats.maxDelay,
      data_as_of: new Date().toISOString(),
    }, { onConflict: 'party_id,import_job_id' });
    updated++;
  }

  await logAuditEvent({
    event_type: 'party_history_recomputed',
    actor_id: user.id,
    description: `Recomputed party_history from realized_outcomes for ${updated} parties.`,
  });

  // Refresh preapproved bands for every touched party (both roles) in parallel.
  const refreshTasks = Object.keys(partyStats).flatMap(partyId => [
    refreshPreapprovedBand(partyId, 'customer'),
    refreshPreapprovedBand(partyId, 'contractor'),
  ]);
  await Promise.all(refreshTasks);

  revalidatePath('/admin');
  return { updated };
}
