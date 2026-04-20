"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent, isAdmin } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

export async function fetchPartiesWithAliases() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('parties')
    .select('id, legal_name, customer_code, party_type, address, aliases:party_aliases(*)')
    .order('legal_name');
  return data || [];
}

export async function handleMergeParties(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) throw new Error('Not authenticated or authorized');

  const supabase = await createClient();
  const primaryId = formData.get('primary_id') as string;
  const duplicateId = formData.get('duplicate_id') as string;

  if (primaryId === duplicateId) throw new Error('Cannot merge a party into itself');

  // We should do all inserts and updates concurrently to minimize partial failures
  const { data: dup } = await supabase.from('parties').select('legal_name').eq('id', duplicateId).single();
  if (!dup) throw new Error('Duplicate party not found');

  try {
    await Promise.all([
      supabase.from('party_aliases').insert({ party_id: primaryId, alias_name: dup.legal_name }),
      supabase.from('credit_cases').update({ customer_party_id: primaryId }).eq('customer_party_id', duplicateId),
      supabase.from('credit_cases').update({ contractor_party_id: primaryId }).eq('contractor_party_id', duplicateId),
      supabase.from('party_exposure').update({ party_id: primaryId }).eq('party_id', duplicateId),
      supabase.from('party_history').update({ party_id: primaryId }).eq('party_id', duplicateId),
      supabase.from('escalations').update({ case_id: primaryId }).eq('case_id', duplicateId) // Fix orphaned records (I8)
    ]);

    // Only delete duplicate if all updates pass
    await supabase.from('parties').delete().eq('id', duplicateId);

    await logAuditEvent({
      event_type: 'party_merged',
      actor_id: user.id,
      description: `Merged duplicate party '${dup.legal_name}' into primary party ID ${primaryId}.`
    });

  } catch (err) {
    throw new Error('Failed to merge parties completely.');
  }

  revalidatePath('/admin/aliases');
}