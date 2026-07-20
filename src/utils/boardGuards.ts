import { createClient } from './supabase/server';
import type { UserProfile } from './auth';

export const BOARD_VOTE_DECISIONS = ['approve', 'reject', 'abstain'] as const;

/**
 * A board vote is only valid when the round is open, inside the voting
 * window, and cast by a member of the round's frozen roster. Role checks
 * alone are not enough — being a board_member does not put you on every
 * committee.
 */
export async function assertCanCastBoardVote(user: UserProfile, boardRoundId: string): Promise<void> {
  const supabase = await createClient();
  const { data: round } = await supabase
    .from('board_rounds')
    .select('status, vote_window_end, roster_snapshot')
    .eq('id', boardRoundId)
    .maybeSingle();

  if (!round) throw new Error('Board round not found.');
  if (round.status !== 'open') {
    throw new Error('This board round is closed — votes can no longer be cast or changed.');
  }
  if (round.vote_window_end && new Date(round.vote_window_end) < new Date()) {
    throw new Error('The voting window for this board round has ended.');
  }
  if (!Array.isArray(round.roster_snapshot) || !round.roster_snapshot.includes(user.id)) {
    throw new Error("Only members of this round's committee roster can vote.");
  }
}
