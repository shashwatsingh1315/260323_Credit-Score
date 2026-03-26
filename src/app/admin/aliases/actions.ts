"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

export async function fetchPartiesWithAliases() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('parties')
    .select('*, aliases:party_aliases(*)')
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

  // 1. Get duplicate party name
  const { data: dup } = await supabase.from('parties').select('legal_name').eq('id', duplicateId).single();
  if (!dup) throw new Error('Duplicate party not found');

  // 2. Create alias for the duplicate name pointing to primary
  await supabase.from('party_aliases').insert({
    party_id: primaryId,
    alias_name: dup.legal_name
  });

  // 3. Move all cases pointing to duplicate over to primary
  await supabase.from('credit_cases').update({ customer_party_id: primaryId }).eq('customer_party_id', duplicateId);
  await supabase.from('credit_cases').update({ contractor_party_id: primaryId }).eq('contractor_party_id', duplicateId);

  // 4. Move history & exposure
  await supabase.from('party_exposure').update({ party_id: primaryId }).eq('party_id', duplicateId);
  await supabase.from('party_history').update({ party_id: primaryId }).eq('party_id', duplicateId);

  // 5. Delete the duplicate record
  await supabase.from('parties').delete().eq('id', duplicateId);

  await logAuditEvent({
    event_type: 'party_merged',
    actor_id: user.id,
    description: `Merged duplicate party '${dup.legal_name}' into primary party ID ${primaryId}.`
  });

  revalidatePath('/admin/aliases');
}