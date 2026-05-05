"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

export async function fetchPartiesWithAliases() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('parties')
    .select('id, legal_name, customer_code, party_type, address, is_candidate, aliases:party_aliases(*)')
    .order('legal_name');
  return data || [];
}

export async function handleMergeParties(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const supabase = await createClient();
  const primaryId = formData.get('primary_id') as string;
  const duplicateId = formData.get('duplicate_id') as string;

  if (primaryId === duplicateId) throw new Error('Cannot merge a party into itself');

  try {
    // 1. Verify primary party exists
    const { data: primary } = await supabase.from('parties').select('legal_name').eq('id', primaryId).single();
    if (!primary) throw new Error('Primary party not found');

    // 2. Get duplicate party name
    const { data: dup } = await supabase.from('parties').select('legal_name').eq('id', duplicateId).single();
    if (!dup) throw new Error('Duplicate party not found');

    // 3. Create alias for the duplicate name pointing to primary
    const { error: aliasErr } = await supabase.from('party_aliases').insert({
      party_id: primaryId,
      alias_name: dup.legal_name
    });
    if (aliasErr) throw new Error(`Failed to create alias: ${aliasErr.message}`);

    // 4. Move all cases pointing to duplicate over to primary
    await supabase.from('credit_cases').update({ customer_party_id: primaryId }).eq('customer_party_id', duplicateId);
    await supabase.from('credit_cases').update({ contractor_party_id: primaryId }).eq('contractor_party_id', duplicateId);

    // 5. Move history & exposure
    await supabase.from('party_exposure').update({ party_id: primaryId }).eq('party_id', duplicateId);
    await supabase.from('party_history').update({ party_id: primaryId }).eq('party_id', duplicateId);

    // 6. Delete the duplicate record
    const { error: delErr } = await supabase.from('parties').delete().eq('id', duplicateId);
    if (delErr) throw new Error(`Failed to delete duplicate party: ${delErr.message}`);

    await logAuditEvent({
      event_type: 'party_merged',
      actor_id: user.id,
      description: `Merged duplicate party '${dup.legal_name}' into primary party '${primary.legal_name}' (ID: ${primaryId}).`
    });

    revalidatePath('/admin/aliases');
  } catch (error: any) {
    console.error('Party merge error:', error);
    throw error;
  }
}