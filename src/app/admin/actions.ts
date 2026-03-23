"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function fetchParties(search?: string) {
  const supabase = await createClient();
  let query = supabase.from('parties').select('*').order('legal_name').limit(100);
  if (search) query = query.ilike('legal_name', `%${search}%`);
  const { data } = await query;
  return data || [];
}

export async function upsertParty(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const id = formData.get('id') as string || undefined;
  const payload: any = {
    legal_name: formData.get('legal_name') as string,
    customer_code: formData.get('customer_code') as string,
    party_type: formData.get('party_type') as string || 'both',
    gstin: formData.get('gstin') as string || null,
    pan: formData.get('pan') as string || null,
    city: formData.get('city') as string || null,
    state: formData.get('state') as string || null,
    industry_sector: formData.get('industry_sector') as string || null,
    credit_limit: parseFloat(formData.get('credit_limit') as string) || null,
    is_active: true,
  };
  if (id) {
    await supabase.from('parties').update(payload).eq('id', id);
  } else {
    await supabase.from('parties').insert(payload);
  }
  await logAuditEvent({ event_type: 'party_upserted', actor_id: user.id, description: `Party '${payload.legal_name}' saved.` });
  revalidatePath('/admin/parties');
}

export async function deactivateParty(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
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
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const userId = formData.get('userId') as string;
  const role = formData.get('role') as string;
  await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
  await logAuditEvent({ event_type: 'role_assigned', actor_id: user.id, description: `Role '${role}' assigned to ${userId}.` });
  revalidatePath('/admin/users');
}

export async function revokeRole(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const userId = formData.get('userId') as string;
  const role = formData.get('role') as string;
  await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
  await logAuditEvent({ event_type: 'role_revoked', actor_id: user.id, description: `Role '${role}' revoked from ${userId}.` });
  revalidatePath('/admin/users');
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
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  
  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) throw new Error('CSV is empty or missing headers');

  // Simple CSV parser for v1 (expects: legal_name, customer_code, party_type)
  // Example headers: legal_name,customer_code,party_type,gstin,pan,city,credit_limit
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const payload = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj: any = {};
    headers.forEach((h, i) => {
      if (values[i]) obj[h] = values[i];
    });
    return {
      legal_name: obj.legal_name || 'Unknown',
      customer_code: obj.customer_code || `CUST-IMP-${Math.floor(Math.random()*10000)}`,
      party_type: obj.party_type || 'both',
      gstin: obj.gstin || null,
      pan: obj.pan || null,
      city: obj.city || null,
      credit_limit: parseFloat(obj.credit_limit) || null,
      is_active: true
    };
  });

  const supabase = await createClient();
  
  // Create import job record
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
}
