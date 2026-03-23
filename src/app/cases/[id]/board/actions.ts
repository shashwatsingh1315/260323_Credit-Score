'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitBoardVote(formData: FormData) {
  const caseId = formData.get('caseId') as string;
  const decision = formData.get('decision') as string;
  const rationale = formData.get('rationale') as string;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Find the active approval_round for this case
  const { data: round } = await supabase
    .from('approval_rounds')
    .select('id')
    .eq('case_id', caseId)
    .eq('round_type', 'Ambiguity_Board')
    .eq('status', 'Pending')
    .single();

  if (round && user) {
    // Submit vote
    await supabase.from('board_votes').insert({
      approval_round_id: round.id,
      voter_id: user.id,
      decision,
      rationale
    });
    
    // Add audit log
    await supabase.from('audit_logs').insert({
      case_id: caseId,
      action_type: 'Board_Vote',
      actor_id: user.id,
      description: `Board Member voted to ${decision}`,
      metadata: { rationale }
    });
  }

  revalidatePath(`/cases/${caseId}/board`);
  revalidatePath(`/cases/${caseId}`);
}
