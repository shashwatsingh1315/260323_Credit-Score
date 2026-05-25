"use server";
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, hasAnyRole } from '@/utils/auth';
import {
  refreshPreapprovedBand,
  getPreapprovedBand,
  type PreapprovedBand,
  type PartyRole,
} from '@/utils/preapproval';

const ROLES: PartyRole[] = ['customer', 'contractor'];

export async function refreshPreapprovedBandAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAnyRole(user, ['founder_admin', 'kam'])) {
    throw new Error('Only Admin or KAM can recompute preapproved bands.');
  }

  const partyId = formData.get('partyId') as string;
  if (!partyId) throw new Error('partyId is required');

  await Promise.all(ROLES.map(r => refreshPreapprovedBand(partyId, r)));
  revalidatePath(`/admin/parties/${partyId}`);
}

export async function getPreapprovedBandsForParty(
  partyId: string,
): Promise<{ customer: PreapprovedBand | null; contractor: PreapprovedBand | null }> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [customer, contractor] = await Promise.all([
    getPreapprovedBand(partyId, 'customer'),
    getPreapprovedBand(partyId, 'contractor'),
  ]);
  return { customer, contractor };
}
