'use server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCurrentUser, logAuditEvent, hasAnyRole, isAdmin } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

/** Statuses where a case is finished and safe to hide from working views. */
const ARCHIVABLE_STATUSES = ['Closed', 'Rejected', 'Cancelled', 'Withdrawn', 'Expired'];

async function loadCaseForLifecycle(caseId: string) {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from('credit_cases')
    .select('id, case_number, status, archived_at, rm_user_id, kam_user_id')
    .eq('id', caseId)
    .maybeSingle();
  if (!c) throw new Error('Case not found');
  return c;
}

function assertCanArchive(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, c: { rm_user_id: string | null; kam_user_id: string | null }) {
  if (isAdmin(user)) return;
  const isOwner =
    (hasAnyRole(user, ['rm']) && c.rm_user_id === user.id) ||
    (hasAnyRole(user, ['kam']) && c.kam_user_id === user.id);
  if (!isOwner) throw new Error('Only the case owner or an admin can archive this case');
}

export async function handleArchiveCase(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const caseId = formData.get('caseId') as string;
  const c = await loadCaseForLifecycle(caseId);
  assertCanArchive(user, c);

  if (c.archived_at) return;
  if (!ARCHIVABLE_STATUSES.includes(c.status)) {
    throw new Error(`Only finished cases can be archived (status is "${c.status}"). Close, withdraw or cancel the case first.`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('credit_cases')
    .update({ archived_at: new Date().toISOString(), archived_by: user.id })
    .eq('id', caseId);
  if (error) throw new Error(`Failed to archive case: ${error.message}`);

  await logAuditEvent({
    case_id: caseId,
    event_type: 'case_archived',
    actor_id: user.id,
    description: `Case ${c.case_number} archived. It is hidden from case lists and search unless "include archived" is on.`,
  });

  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
}

export async function handleRestoreCase(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const caseId = formData.get('caseId') as string;
  const c = await loadCaseForLifecycle(caseId);
  assertCanArchive(user, c);

  if (!c.archived_at) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from('credit_cases')
    .update({ archived_at: null, archived_by: null })
    .eq('id', caseId);
  if (error) throw new Error(`Failed to restore case: ${error.message}`);

  await logAuditEvent({
    case_id: caseId,
    event_type: 'case_restored',
    actor_id: user.id,
    description: `Case ${c.case_number} restored from the archive.`,
  });

  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
}

/**
 * Permanent, admin-only deletion — removes the case row and every child record
 * via ON DELETE CASCADE (review cycles, stage tasks, approval/board rounds,
 * repayments, credit notes, comments, documents, escalations, case-scoped
 * audit events). A case must be archived first, and the caller must retype the
 * case number. A final audit event is written WITHOUT case_id so the record of
 * the deletion itself survives the cascade.
 */
export async function handleDeleteCase(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only an admin can permanently delete a case');

  const caseId = formData.get('caseId') as string;
  const confirmText = ((formData.get('confirmText') as string) || '').trim();
  const c = await loadCaseForLifecycle(caseId);

  if (!c.archived_at) throw new Error('Archive the case first — only archived cases can be permanently deleted.');
  if (confirmText !== c.case_number) {
    throw new Error('Confirmation text does not match the case number. Nothing was deleted.');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server misconfiguration: Missing Supabase Admin credentials');
  }
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await supabaseAdmin.from('credit_cases').delete().eq('id', caseId);
  if (error) throw new Error(`Failed to delete case: ${error.message}`);

  // No case_id on purpose: case-scoped audit events were just cascaded away.
  await logAuditEvent({
    event_type: 'case_deleted',
    actor_id: user.id,
    description: `Case ${c.case_number} and all its data were permanently deleted by an admin.`,
    metadata: { case_number: c.case_number, deleted_case_id: caseId, status_at_deletion: c.status },
  });

  revalidatePath('/cases');
  redirect('/cases?archived=only');
}
