"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function fetchBoardDetails(caseId: string) {
  const supabase = await createClient();

  const { data: caseData } = await supabase
    .from('credit_cases')
    .select('*, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
    .eq('id', caseId)
    .single();

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('id, active_stage, current_case_score, approved_credit_days, is_ambiguous')
    .eq('case_id', caseId)
    .eq('is_active', true)
    .single();

  if (!cycle) return { caseData, boardRound: null, votes: [] };

  // Find the active approval round that is a board type
  const { data: approvalRound } = await supabase
    .from('approval_rounds')
    .select('*')
    .eq('review_cycle_id', cycle.id)
    .in('round_type', ['appeal', 'ambiguity_board'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!approvalRound) return { caseData, boardRound: null, votes: [] };

  // Get the actual board round
  let { data: boardRound } = await supabase
    .from('board_rounds')
    .select('*')
    .eq('approval_round_id', approvalRound.id)
    .single();

  // Auto-create board round if it doesn't exist yet but approval round does
  if (!boardRound) {
    // Get default committee roster
    const { data: roster } = await supabase.from('committee_rosters').select('member_ids').eq('is_active', true).limit(1).single();
    const members = roster?.member_ids || [];
    
    // Set a default 3-day vote window
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + 3);

    const { data: newBoardRound } = await supabase.from('board_rounds').insert({
      approval_round_id: approvalRound.id,
      roster_snapshot: members,
      vote_window_end: windowEnd.toISOString(),
      status: 'open'
    }).select().single();

    boardRound = newBoardRound;
  }

  // Get all votes with voter info
  const { data: votes } = await supabase
    .from('board_votes')
    .select('*, voter:profiles!board_votes_voter_id_fkey(full_name, email)')
    .eq('board_round_id', boardRound.id);

  // Get roster member details to show pending
  const { data: rosterMembers } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', boardRound.roster_snapshot || []);

  return { caseData, approvalRound, boardRound, votes: votes || [], rosterMembers: rosterMembers || [] };
}

export async function submitBoardVote(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const caseId = formData.get('caseId') as string;
  const boardRoundId = formData.get('boardRoundId') as string;
  const decision = formData.get('decision') as string; // 'approve', 'reject', 'abstain'
  const comment = formData.get('comment') as string;

  // Upsert vote (users can change vote until window closes)
  await supabase.from('board_votes').upsert({
    board_round_id: boardRoundId,
    voter_id: user.id,
    decision,
    comment,
    updated_at: new Date().toISOString()
  }, { onConflict: 'board_round_id, voter_id' });

  await logAuditEvent({
    case_id: caseId,
    event_type: 'board_vote',
    actor_id: user.id,
    description: `Board Member voted to ${decision}.`
  });

  revalidatePath(`/cases/${caseId}/board`);
  revalidatePath(`/cases/${caseId}`);
}

export async function finalizeBoardDecision(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const caseId = formData.get('caseId') as string;
  const cycleId = formData.get('cycleId') as string;
  const approvalRoundId = formData.get('approvalRoundId') as string;
  const boardRoundId = formData.get('boardRoundId') as string;
  const boardDecision = formData.get('boardDecision') as string; // 'uphold', 'reject', 'override'
  const overrideDays = formData.get('overrideDays') ? parseInt(formData.get('overrideDays') as string) : null;
  const overrideReason = formData.get('overrideReason') as string || null;
  const overrideExplanation = formData.get('overrideExplanation') as string || null;

  // Close the board round
  await supabase.from('board_rounds').update({
    status: 'closed',
    board_decision: boardDecision,
    override_credit_days: overrideDays,
    override_reason_code: overrideReason,
    override_explanation: overrideExplanation
  }).eq('id', boardRoundId);

  // Reflect outcome in approval round and case
  if (boardDecision === 'reject') {
    await supabase.from('approval_rounds').update({ status: 'rejected', resolved_at: new Date().toISOString() }).eq('id', approvalRoundId);
    await supabase.from('credit_cases').update({ status: 'Rejected' }).eq('id', caseId);
  } else if (boardDecision === 'override') {
    await supabase.from('approval_rounds').update({ status: 'approved', resolved_at: new Date().toISOString() }).eq('id', approvalRoundId);
    await supabase.from('review_cycles').update({ approved_credit_days: overrideDays, decision: 'approved' }).eq('id', cycleId);
    await supabase.from('credit_cases').update({ status: 'Approved' }).eq('id', caseId);
  } else {
    // Uphold = Approved normally
    await supabase.from('approval_rounds').update({ status: 'approved', resolved_at: new Date().toISOString() }).eq('id', approvalRoundId);
    await supabase.from('review_cycles').update({ decision: 'approved' }).eq('id', cycleId);
    await supabase.from('credit_cases').update({ status: 'Approved' }).eq('id', caseId);
  }

  await logAuditEvent({
    case_id: caseId,
    review_cycle_id: cycleId,
    event_type: boardDecision === 'override' ? 'override' : 'board_decision',
    actor_id: user.id,
    description: `Board decision finalized: ${boardDecision}. ${overrideDays ? `Overridden to ${overrideDays} days.` : ''}`
  });

  revalidatePath(`/cases/${caseId}/board`);
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}