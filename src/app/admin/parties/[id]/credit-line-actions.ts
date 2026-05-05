"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, isAdmin, logAuditEvent } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

export async function setCreditLineAmount(partyId: string, amount: number | null) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) throw new Error('Unauthorized');

  const supabase = await createClient();
  const { error } = await supabase.from('parties').update({
    credit_line_amount: amount,
    credit_line_set_at: new Date().toISOString(),
    credit_line_set_by: user.id
  }).eq('id', partyId);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    event_type: 'credit_line_updated',
    actor_id: user.id,
    description: `Credit line for party ${partyId} set to ${amount}`
  });

  revalidatePath('/admin');
}
