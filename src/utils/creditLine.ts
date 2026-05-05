import { createClient } from './supabase/server';

export async function validateCreditLine(partyId: string, requestedExposure: number, billAmount: number) {
  if (!partyId) return { valid: true };

  const supabase = await createClient();
  const { data: party, error } = await supabase
    .from('parties')
    .select('credit_line_amount')
    .eq('id', partyId)
    .single();

  if (error || !party) return { valid: true };

  const creditLine = party.credit_line_amount;
  if (creditLine === null || creditLine === undefined) {
    return { valid: true }; // No limit configured
  }

  if (requestedExposure > creditLine) {
    return { 
      valid: false, 
      credit_line_amount: creditLine,
      message: `Requested exposure (₹${requestedExposure.toLocaleString('en-IN')}) exceeds the configured manual credit limit (₹${creditLine.toLocaleString('en-IN')}).`
    };
  }

  return { valid: true, credit_line_amount: creditLine };
}
