import Papa from 'papaparse';

export interface PartyImportRow {
  legal_name: string;
  customer_code: string;
  party_type: string | null;
  influencer_subtype: string | null;
  gst_number: string | null;
  pan_number: string | null;
  address: string | null;
  credit_limit: number | null;
  is_active: boolean;
}

/**
 * Parses a CSV string into a structured array of party objects for import.
 * Handles header normalization and provides default values for missing fields.
 *
 * @param text The CSV content as a string
 * @returns Array of PartyImportRow objects
 * @throws Error if parsing fails or CSV is empty
 */
export function parsePartiesCsv(text: string): PartyImportRow[] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('CSV is empty or missing headers');
  }

  const result = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header: string) => header.trim().toLowerCase()
  });

  const criticalErrors = result.errors?.filter(e => !e.message.includes('auto-detect'));
  if (criticalErrors && criticalErrors.length > 0) {
    throw new Error('CSV parsing error: ' + criticalErrors[0].message);
  }

  const rows = result.data;
  if (rows.length === 0 || (rows.length === 1 && Object.keys(rows[0]).length === 0)) {
    throw new Error('CSV is empty or missing headers');
  }

  const parsedParties: PartyImportRow[] = [];

  for (const obj of rows) {
    // Clean string values
    const legal_name = (obj.legal_name || '').trim();
    if (!legal_name) {
      throw new Error('CSV contains a row missing a legal_name, which is required.');
    }

    const customer_code = (obj.customer_code || '').trim() || `CUST-IMP-${crypto.randomUUID()}`;
    const party_type = (obj.party_type || '').trim() || 'both';
    const influencer_subtype = (obj.influencer_subtype || '').trim() || null;
    const gst_number = (obj.gstin || obj.gst_number || '').trim() || null;
    const pan_number = (obj.pan || obj.pan_number || '').trim() || null;
    const address = (obj.city || obj.address || '').trim() || null;
    
    let credit_limit: number | null = null;
    if (obj.credit_limit && obj.credit_limit.trim() !== '') {
      const parsedCredit = parseFloat(obj.credit_limit.replace(/,/g, '').trim());
      if (!isNaN(parsedCredit)) {
        credit_limit = parsedCredit;
      }
    }

    parsedParties.push({
      legal_name,
      customer_code,
      party_type,
      influencer_subtype,
      gst_number,
      pan_number,
      address,
      credit_limit,
      is_active: true
    });
  }

  return parsedParties;
}
