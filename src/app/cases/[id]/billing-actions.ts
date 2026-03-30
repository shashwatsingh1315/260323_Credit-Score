"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent, hasAnyRole, isAdmin as checkIsAdmin } from '@/utils/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function getSystemSetting(key: string, fallback: number): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single();
  return data ? Number(data.value) : fallback;
}

/**
 * Fetch all Phase-2 ledger data for a case.
 * Includes billing fields, repayments log, credit notes, and computed tranche state.
 */
export async function fetchLedgerData(caseId: string) {
  const supabase = await createClient();

  const [
    { data: caseData },
    { data: repayments },
    { data: creditNotes },
  ] = await Promise.all([
    supabase
      .from('credit_cases')
      .select('id, status, billing_date, decided_bill_amount, promised_bill_amount, actual_bill_amount, proposed_tranches')
      .eq('id', caseId)
      .single(),
    supabase
      .from('repayments')
      .select('*, logged_by_profile:profiles!repayments_logged_by_fkey(full_name)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true }),
    supabase
      .from('credit_notes')
      .select('*, logged_by_profile:profiles!credit_notes_logged_by_fkey(full_name), approved_by_profile:profiles!credit_notes_approved_by_fkey(full_name)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false }),
  ]);

  if (!caseData) return null;

  // ── Tranche waterfall calculation ──────────────────────────────
  // We build a mutable list of tranches with their fill status,
  // given the billing_date as the clock-start.
  const tranches: {
    index: number;
    dueDate: Date | null;
    expectedAmount: number;    // whole rupees
    paidAmount: number;        // how much of this tranche is funded
    status: 'Paid' | 'Partial' | 'Delayed' | 'Upcoming' | 'No Billing';
  }[] = [];

  if (caseData.billing_date && caseData.proposed_tranches && caseData.decided_bill_amount) {
    const billingDate = new Date(caseData.billing_date);
    const billAmt = caseData.decided_bill_amount;

    // Map raw DB tranches to rupee amounts + due dates
    const rawTranches: { expectedAmount: number; dueDate: Date }[] =
      (caseData.proposed_tranches as any[]).map((t: any) => {
        const amt = t.type === 'percentage'
          ? Math.round((t.value / 100) * billAmt)
          : Math.round(t.value);
        const due = new Date(billingDate);
        due.setDate(due.getDate() + (t.days_after_billing || 0));
        return { expectedAmount: amt, dueDate: due };
      });

    // Waterfall: allocate repayments sequentially by DB creation order
    let remainingPaid = repayments?.reduce((s, r) => s + r.amount, 0) ?? 0;
    const now = new Date();

    rawTranches.forEach((rt, i) => {
      const fill = Math.min(remainingPaid, rt.expectedAmount);
      remainingPaid -= fill;

      let status: typeof tranches[number]['status'];
      if (fill >= rt.expectedAmount) {
        status = 'Paid';
      } else if (fill > 0) {
        status = rt.dueDate < now ? 'Delayed' : 'Partial';
      } else {
        status = rt.dueDate < now ? 'Delayed' : 'Upcoming';
      }

      tranches.push({
        index: i,
        dueDate: rt.dueDate,
        expectedAmount: rt.expectedAmount,
        paidAmount: fill,
        status,
      });
    });
  }

  // ── Earliest unfunded tranche remaining amount (for UX pre-fill) ──
  const earliestUnfunded = tranches.find(t => t.status !== 'Paid');
  const prefillAmount = earliestUnfunded
    ? earliestUnfunded.expectedAmount - earliestUnfunded.paidAmount
    : 0;

  return {
    billing: {
      billingDate: caseData.billing_date,
      decidedAmount: caseData.decided_bill_amount,
      promisedAmount: caseData.promised_bill_amount,
      actualAmount: caseData.actual_bill_amount,
      isLocked: (repayments?.length ?? 0) > 0,
    },
    tranches,
    prefillAmount,
    repayments: repayments ?? [],
    creditNotes: creditNotes ?? [],
    status: caseData.status,
  };
}

// ─────────────────────────────────────────────
// BILLING FRAME ACTIONS
// ─────────────────────────────────────────────

/**
 * RM saves the initial billing details (Decided, Promised, Billing Date).
 * Freely editable until the first payment is logged.
 */
export async function handleSaveBillingDetails(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['rm', 'founder_admin'])) {
    throw new Error('Only RM or Admin can set billing details.');
  }

  const caseId = formData.get('caseId') as string;
  const billingDate = formData.get('billingDate') as string;
  const decidedAmount = parseInt(formData.get('decidedAmount') as string, 10);
  const promisedAmount = parseInt(formData.get('promisedAmount') as string, 10);

  if (!billingDate || isNaN(decidedAmount) || isNaN(promisedAmount)) {
    throw new Error('Billing date, decided amount, and promised amount are required.');
  }
  if (decidedAmount <= 0 || promisedAmount <= 0) {
    throw new Error('Amounts must be positive whole rupees.');
  }

  const supabase = await createClient();

  // Guard: cannot edit if payments already exist (ledger is locked)
  const { count } = await supabase
    .from('repayments')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', caseId);

  if ((count ?? 0) > 0) {
    throw new Error('Billing details are locked because payments have already been recorded. Issue a Credit Note to adjust amounts.');
  }

  const { error } = await supabase.from('credit_cases').update({
    billing_date: billingDate,
    decided_bill_amount: decidedAmount,
    promised_bill_amount: promisedAmount,
    status: 'Billing Active',
  }).eq('id', caseId);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    case_id: caseId,
    event_type: 'billing_details_saved',
    actor_id: user.id,
    description: `Billing initialized. Decided: ₹${decidedAmount.toLocaleString('en-IN')}, Promised: ₹${promisedAmount.toLocaleString('en-IN')}, Billing Date: ${billingDate}.`,
  });

  revalidatePath(`/cases/${caseId}`);
}

/**
 * KAM cancels the bill entirely (only before any payment).
 */
export async function handleCancelBilling(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can cancel a bill.');
  }

  const caseId = formData.get('caseId') as string;
  const reason = (formData.get('reason') as string) || 'Order cancelled before dispatch.';
  const supabase = await createClient();

  const { count } = await supabase
    .from('repayments')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', caseId);

  if ((count ?? 0) > 0) {
    throw new Error('Cannot cancel a bill that already has payments recorded.');
  }

  await supabase.from('credit_cases').update({
    status: 'Cancelled',
    closure_reason: reason,
  }).eq('id', caseId);

  await logAuditEvent({
    case_id: caseId,
    event_type: 'billing_cancelled',
    actor_id: user.id,
    description: `Bill cancelled before any payments. Reason: ${reason}`,
  });

  revalidatePath(`/cases/${caseId}`);
}

// ─────────────────────────────────────────────
// REPAYMENT LEDGER ACTIONS
// ─────────────────────────────────────────────

/**
 * KAM logs a new payment. Triggers the DB hook that updates actual_bill_amount.
 * After insert, checks if promised amount is fulfilled → auto-close.
 * Or if slippage too high on attempted close → Pending Write-Off Approval.
 */
export async function handleLogPayment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can log payments.');
  }

  const caseId = formData.get('caseId') as string;
  const amount = parseInt(formData.get('amount') as string, 10);
  const paymentDate = formData.get('paymentDate') as string;
  const referenceUrl = (formData.get('referenceUrl') as string) || null;
  const description = (formData.get('description') as string) || null;

  if (isNaN(amount) || amount <= 0) throw new Error('Payment amount must be a positive whole number (rupees).');
  if (!paymentDate) throw new Error('Payment date is required.');

  const supabase = await createClient();

  // Ensure case is in a state that accepts payments
  const { data: caseRow } = await supabase
    .from('credit_cases')
    .select('status, promised_bill_amount, actual_bill_amount')
    .eq('id', caseId)
    .single();

  if (!caseRow) throw new Error('Case not found.');
  if (!['Billing Active', 'Pending Write-Off Approval'].includes(caseRow.status)) {
    throw new Error(`Payments cannot be logged on a case with status: ${caseRow.status}`);
  }

  const { error } = await supabase.from('repayments').insert({
    case_id: caseId,
    amount,
    payment_date: paymentDate,
    reference_url: referenceUrl,
    description,
    logged_by: user.id,
  });

  if (error) throw new Error(error.message);

  // Refresh actual amount from DB (trigger already ran, re-fetch)
  const { data: updated } = await supabase
    .from('credit_cases')
    .select('actual_bill_amount, promised_bill_amount')
    .eq('id', caseId)
    .single();

  if (updated) {
    await checkAndCloseCase(caseId, updated.actual_bill_amount, updated.promised_bill_amount, user.id, supabase);
  }

  await logAuditEvent({
    case_id: caseId,
    event_type: 'payment_logged',
    actor_id: user.id,
    description: `Payment of ₹${amount.toLocaleString('en-IN')} logged on ${paymentDate}.${description ? ` Note: ${description}` : ''}`,
  });

  revalidatePath(`/cases/${caseId}`);
}

/**
 * Shared utility: after each payment, evaluate closure eligibility.
 */
async function checkAndCloseCase(
  caseId: string,
  actualAmount: number,
  promisedAmount: number | null,
  actorId: string,
  supabase: any,
) {
  if (!promisedAmount || promisedAmount <= 0) return;

  if (actualAmount >= promisedAmount) {
    // Auto-close: actual >= promised
    await supabase.from('credit_cases').update({ status: 'Closed' }).eq('id', caseId);
    await logAuditEvent({
      case_id: caseId,
      event_type: 'case_auto_closed',
      actor_id: actorId,
      description: `Case auto-closed: Actual (₹${actualAmount.toLocaleString('en-IN')}) met Promised (₹${promisedAmount.toLocaleString('en-IN')}).`,
    });
  }
  // If promisedAmount not yet met, we just stay Billing Active.
  // Write-off trigger only fires when KAM explicitly "closes" with a shortfall.
}

/**
 * KAM edits a previously logged payment (typo fix). Full audit trail written.
 */
export async function handleEditPayment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can edit payments.');
  }

  const paymentId = formData.get('paymentId') as string;
  const caseId = formData.get('caseId') as string;
  const newAmount = parseInt(formData.get('amount') as string, 10);
  const paymentDate = formData.get('paymentDate') as string;
  const referenceUrl = (formData.get('referenceUrl') as string) || null;
  const description = (formData.get('description') as string) || null;

  if (isNaN(newAmount) || newAmount <= 0) throw new Error('Amount must be a positive whole number.');

  const supabase = await createClient();

  // Read original for audit diff
  const { data: original } = await supabase.from('repayments').select('*').eq('id', paymentId).single();
  if (!original) throw new Error('Payment not found.');

  const { error } = await supabase.from('repayments').update({
    amount: newAmount,
    payment_date: paymentDate,
    reference_url: referenceUrl,
    description,
  }).eq('id', paymentId);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    case_id: caseId,
    event_type: 'payment_edited',
    actor_id: user.id,
    description: `Payment edited.`,
    field_diffs: {
      amount: { from: original.amount, to: newAmount },
      payment_date: { from: original.payment_date, to: paymentDate },
    },
  });

  // Re-check close conditions after amount change
  const { data: updated } = await supabase
    .from('credit_cases')
    .select('actual_bill_amount, promised_bill_amount')
    .eq('id', caseId)
    .single();

  if (updated) {
    await checkAndCloseCase(caseId, updated.actual_bill_amount, updated.promised_bill_amount, user.id, supabase);
  }

  revalidatePath(`/cases/${caseId}`);
}

/**
 * KAM deletes a payment entry. Full audit trail written.
 */
export async function handleDeletePayment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can delete payments.');
  }

  const paymentId = formData.get('paymentId') as string;
  const caseId = formData.get('caseId') as string;
  const supabase = await createClient();

  const { data: original } = await supabase.from('repayments').select('amount, payment_date').eq('id', paymentId).single();

  const { error } = await supabase.from('repayments').delete().eq('id', paymentId);
  if (error) throw new Error(error.message);

  await logAuditEvent({
    case_id: caseId,
    event_type: 'payment_deleted',
    actor_id: user.id,
    description: `Payment of ₹${original?.amount?.toLocaleString('en-IN')} on ${original?.payment_date} was deleted.`,
    field_diffs: { deleted_payment: original },
  });

  // Revert status to Billing Active if case was auto-closed before this deletion
  const { data: caseRow } = await supabase
    .from('credit_cases')
    .select('status, actual_bill_amount, promised_bill_amount')
    .eq('id', caseId)
    .single();

  if (caseRow?.status === 'Closed' && (caseRow.actual_bill_amount ?? 0) < (caseRow.promised_bill_amount ?? 0)) {
    await supabase.from('credit_cases').update({ status: 'Billing Active' }).eq('id', caseId);
  }

  revalidatePath(`/cases/${caseId}`);
}

/**
 * KAM manually attempts to close a case.
 * If Actual < Promised and gap > slippage threshold → Pending Write-Off Approval.
 * Otherwise closes directly.
 */
export async function handleAttemptClose(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can close a billing case.');
  }

  const caseId = formData.get('caseId') as string;
  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from('credit_cases')
    .select('actual_bill_amount, promised_bill_amount, status')
    .eq('id', caseId)
    .single();

  if (!caseRow) throw new Error('Case not found.');
  if (caseRow.status === 'Closed') return; // Already closed

  const actual = caseRow.actual_bill_amount ?? 0;
  const promised = caseRow.promised_bill_amount ?? 0;

  if (actual >= promised) {
    await supabase.from('credit_cases').update({ status: 'Closed' }).eq('id', caseId);
    await logAuditEvent({ case_id: caseId, event_type: 'case_closed', actor_id: user.id, description: 'Case manually closed. Full amount collected.' });
  } else {
    // Check slippage
    const slippageThreshold = await getSystemSetting('WRITE_OFF_SLIPPAGE_PERCENTAGE', 10);
    const slippageActual = promised > 0 ? ((promised - actual) / promised) * 100 : 100;

    if (slippageActual > slippageThreshold) {
      await supabase.from('credit_cases').update({ status: 'Pending Write-Off Approval' }).eq('id', caseId);
      await logAuditEvent({
        case_id: caseId,
        event_type: 'write_off_requested',
        actor_id: user.id,
        description: `Write-off requested. Shortfall: ₹${(promised - actual).toLocaleString('en-IN')} (${slippageActual.toFixed(1)}% gap, threshold: ${slippageThreshold}%).`,
      });
    } else {
      // Within acceptable slippage — close directly
      await supabase.from('credit_cases').update({ status: 'Closed' }).eq('id', caseId);
      await logAuditEvent({
        case_id: caseId,
        event_type: 'case_closed',
        actor_id: user.id,
        description: `Case closed within acceptable slippage (${slippageActual.toFixed(1)}%). Shortfall: ₹${(promised - actual).toLocaleString('en-IN')}.`,
      });
    }
  }

  revalidatePath(`/cases/${caseId}`);
}

// ─────────────────────────────────────────────
// CREDIT NOTE ACTIONS
// ─────────────────────────────────────────────

/**
 * KAM / RM issues a credit note to reduce Decided/Promised amount.
 * Requires Admin approval before taking effect.
 */
export async function handleIssueCreditNote(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'rm', 'founder_admin'])) {
    throw new Error('Only KAM, RM, or Admin can issue credit notes.');
  }

  const caseId = formData.get('caseId') as string;
  const reductionAmount = parseInt(formData.get('reductionAmount') as string, 10);
  const reason = formData.get('reason') as string;

  if (isNaN(reductionAmount) || reductionAmount <= 0) throw new Error('Reduction amount must be a positive whole number.');
  if (!reason?.trim()) throw new Error('A reason is required for the credit note.');

  const supabase = await createClient();

  const { error } = await supabase.from('credit_notes').insert({
    case_id: caseId,
    reduction_amount: reductionAmount,
    reason: reason.trim(),
    logged_by: user.id,
    status: 'pending',
  });

  if (error) throw new Error(error.message);

  await logAuditEvent({
    case_id: caseId,
    event_type: 'credit_note_issued',
    actor_id: user.id,
    description: `Credit note issued for ₹${reductionAmount.toLocaleString('en-IN')}. Reason: ${reason}. Awaiting Admin approval.`,
  });

  revalidatePath(`/cases/${caseId}`);
}

/**
 * Admin approves or rejects a credit note.
 * On approval, reduces the promised_bill_amount on the case.
 */
export async function handleCreditNoteApproval(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!checkIsAdmin(user)) throw new Error('Only Admin can approve or reject credit notes.');

  const creditNoteId = formData.get('creditNoteId') as string;
  const caseId = formData.get('caseId') as string;
  const decision = formData.get('decision') as 'approved' | 'rejected';

  if (!['approved', 'rejected'].includes(decision)) throw new Error('Invalid decision.');

  const supabase = await createClient();

  const { data: note } = await supabase.from('credit_notes').select('*').eq('id', creditNoteId).single();
  if (!note) throw new Error('Credit note not found.');
  if (note.status !== 'pending') throw new Error('Credit note is already resolved.');

  await supabase.from('credit_notes').update({
    status: decision,
    approved_by: user.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', creditNoteId);

  if (decision === 'approved') {
    // Apply reduction to promised_bill_amount (floor at 0)
    const { data: caseRow } = await supabase.from('credit_cases')
      .select('promised_bill_amount, decided_bill_amount')
      .eq('id', caseId).single();

    const newPromised = Math.max(0, (caseRow?.promised_bill_amount ?? 0) - note.reduction_amount);

    await supabase.from('credit_cases').update({
      promised_bill_amount: newPromised,
    }).eq('id', caseId);
  }

  await logAuditEvent({
    case_id: caseId,
    event_type: 'credit_note_resolved',
    actor_id: user.id,
    description: `Credit note ${decision}. Amount: ₹${note.reduction_amount.toLocaleString('en-IN')}.`,
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────
// WRITE-OFF APPROVAL (FOUNDER ONLY)
// ─────────────────────────────────────────────

/**
 * Founder approves or rejects a Pending Write-Off.
 */
export async function handleWriteOffApproval(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!checkIsAdmin(user)) throw new Error('Only Admin/Founder can approve write-offs.');

  const caseId = formData.get('caseId') as string;
  const decision = formData.get('decision') as 'approve' | 'reject';
  const note = (formData.get('note') as string) || '';
  const supabase = await createClient();

  if (decision === 'approve') {
    await supabase.from('credit_cases').update({ status: 'Closed' }).eq('id', caseId);
    await logAuditEvent({
      case_id: caseId,
      event_type: 'write_off_approved',
      actor_id: user.id,
      description: `Write-off approved by Admin. Case closed with shortfall. ${note}`,
    });
  } else {
    // Reject: push back to Billing Active for the KAM to continue collecting
    await supabase.from('credit_cases').update({ status: 'Billing Active' }).eq('id', caseId);
    await logAuditEvent({
      case_id: caseId,
      event_type: 'write_off_rejected',
      actor_id: user.id,
      description: `Write-off rejected by Admin. Case returned to Billing Active. ${note}`,
    });
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────
// TRANCHE RESTRUCTURE
// ─────────────────────────────────────────────

/**
 * KAM extends / restructures tranche dates. Enforces MAX_TRANCHE_EXTENSION_DAYS.
 */
export async function handleRestructureTranches(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['kam', 'founder_admin'])) {
    throw new Error('Only KAM or Admin can restructure tranches.');
  }

  const caseId = formData.get('caseId') as string;
  const newTranches = JSON.parse(formData.get('tranches') as string) as any[];
  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from('credit_cases')
    .select('proposed_tranches, billing_date')
    .eq('id', caseId)
    .single();

  if (!caseRow?.billing_date) throw new Error('Billing date not set — cannot restructure tranches.');

  const maxExtensionDays = await getSystemSetting('MAX_TRANCHE_EXTENSION_DAYS', 30);
  const billingDate = new Date(caseRow.billing_date);

  // Validate each tranche's extension vs the original schedule
  const origTranches = caseRow.proposed_tranches as any[];
  for (let i = 0; i < newTranches.length; i++) {
    const origDaysAfter = origTranches[i]?.days_after_billing ?? 0;
    const newDaysAfter = newTranches[i]?.days_after_billing ?? 0;
    const extension = newDaysAfter - origDaysAfter;

    if (extension > maxExtensionDays) {
      throw new Error(
        `Tranche ${i + 1}: extension of ${extension} days exceeds the maximum allowed (${maxExtensionDays} days).`
      );
    }
  }

  await supabase.from('credit_cases').update({ proposed_tranches: newTranches }).eq('id', caseId);

  await logAuditEvent({
    case_id: caseId,
    event_type: 'tranches_restructured',
    actor_id: user.id,
    description: `Tranches restructured by KAM.`,
    field_diffs: { old_tranches: origTranches, new_tranches: newTranches },
  });

  revalidatePath(`/cases/${caseId}`);
}

// ─────────────────────────────────────────────
// SYSTEM SETTINGS (ADMIN)
// ─────────────────────────────────────────────

export async function fetchSystemSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from('system_settings').select('*').order('key');
  return data ?? [];
}

export async function updateSystemSetting(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!checkIsAdmin(user)) throw new Error('Only Admin can modify system settings.');

  const key = formData.get('key') as string;
  const value = parseFloat(formData.get('value') as string);

  if (!key || isNaN(value)) throw new Error('Invalid setting key or value.');

  const supabase = await createClient();
  const { error } = await supabase.from('system_settings').update({
    value,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }).eq('key', key);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    event_type: 'setting_updated',
    actor_id: user.id,
    description: `System setting "${key}" updated to ${value}.`,
  });

  revalidatePath('/settings');
}
