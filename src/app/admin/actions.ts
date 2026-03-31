'use server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCurrentUser, logAuditEvent } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { parsePartiesCsv } from '@/utils/csv';

export async function fetchParties(search?: string) {
  const supabase = await createClient();
  let query = supabase.from('parties').select('*').order('legal_name').limit(100);
  if (search) query = query.ilike('legal_name', `%${search}%`);
  const { data } = await query;
  return data || [];
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
      gst_number: formData.get('gstin') as string || null,
      pan_number: formData.get('pan') as string || null,
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
      revalidatePath('/admin/parties');
      return { success: true, party: data };
    }
    await logAuditEvent({ event_type: 'party_upserted', actor_id: user.id, description: `Party '${payload.legal_name}' saved.` });
    revalidatePath('/admin/parties');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deactivateParty(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can deactivate parties');

  const supabase = await createClient();
  await supabase.from('parties').update({ is_active: false }).eq('id', formData.get('id'));
  await logAuditEvent({ event_type: 'party_deactivated', actor_id: user.id, description: `Party ${formData.get('id')} deactivated.` });
  revalidatePath('/admin/parties');
}

export async function fetchAllUsers() {
  const supabase = await createClient();
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
    const supabase = await createClient();
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;
    await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
    await logAuditEvent({ event_type: 'role_assigned', actor_id: user.id, description: `Role '${role}' assigned to ${userId}.` });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function revokeRole(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    const supabase = await createClient();
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
    await logAuditEvent({ event_type: 'role_revoked', actor_id: user.id, description: `Role '${role}' revoked from ${userId}.` });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function fetchGlobalAuditLog(limit = 100) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_events')
    .select('*, actor:profiles!audit_events_actor_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function importPartiesCsv(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const text = await file.text();
    const payload = parsePartiesCsv(text);

    const supabase = await createClient();
    
    const { data: job } = await supabase.from('import_jobs').insert({
      imported_by: user.id,
      import_type: 'party_master',
      status: 'processing',
      records_total: payload.length
    }).select('id').single();

    const { error } = await supabase.from('parties').insert(payload);

    await supabase.from('import_jobs').update({
      status: error ? 'failed' : 'completed',
      records_processed: error ? 0 : payload.length,
      error_details: error ? { message: error.message } : null,
      completed_at: new Date().toISOString()
    }).eq('id', job!.id);

    if (error) throw new Error(error.message);

    await logAuditEvent({ 
      event_type: 'party_csv_import', 
      actor_id: user.id, 
      description: `Imported ${payload.length} parties via CSV.` 
    });
    
    revalidatePath('/admin');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}


import { isAdmin, hasAnyRole } from '@/utils/auth';

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

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

    if (profileError) console.error("Profile creation error:", profileError);

    await supabaseAdmin.from('user_roles').upsert({
      user_id: newUserId,
      role: role
    });

    await logAuditEvent({ event_type: 'user_created', actor_id: user.id, description: `Created new user ${email} with role ${role}` });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function adminDeleteUser(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!isAdmin(user)) return { success: false, error: 'Unauthorized' };

    const targetUserId = formData.get('userId') as string;
    if (!targetUserId) throw new Error('Missing user ID');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (error) throw new Error(error.message);

    await logAuditEvent({ event_type: 'user_deleted', actor_id: user.id, description: `Deleted user ${targetUserId}` });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
