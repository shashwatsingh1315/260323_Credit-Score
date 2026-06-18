import { createClient } from './supabase/server';

export async function validateCreditLine(partyId: string, requestedExposure: number, billAmount: number): Promise<{  // eslint-disable-line @typescript-eslint/no-unused-vars
  valid: boolean; 
  credit_line_amount: number | null; 
  message: string | null; 
}> {
  if (!partyId) return { valid: true, credit_line_amount: null, message: null };

  const supabase = await createClient();
  const { data: party, error } = await supabase
    .from('parties')
    .select('credit_line_amount')
    .eq('id', partyId)
    .maybeSingle();

  if (error || !party) {
    return { valid: true, credit_line_amount: null, message: null };
  }

  const creditLine = party.credit_line_amount;
  if (creditLine === null || creditLine === undefined) {
    return { valid: true, credit_line_amount: null, message: null }; // No limit configured
  }

  if (requestedExposure > creditLine) {
    return { 
      valid: false, 
      credit_line_amount: creditLine,
      message: `Requested exposure (₹${requestedExposure.toLocaleString('en-IN')}) exceeds the configured manual credit limit (₹${creditLine.toLocaleString('en-IN')}).`
    };
  }

  return { valid: true, credit_line_amount: creditLine, message: null };
}
