export interface PartyImportRow {
  legal_name: string;
  customer_code: string;
  gst_number: string | null;
  pan_number: string | null;
  address: string | null;
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
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) {
    throw new Error('CSV is empty or missing headers');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj: any = {};
    headers.forEach((h, i) => {
      if (values[i]) obj[h] = values[i];
    });

    // Generate a random customer code if not provided, matching original logic
    const defaultCustomerCode = `CUST-IMP-${Math.floor(Math.random() * 10000)}`;

    return {
      legal_name: obj.legal_name || 'Unknown',
      customer_code: obj.customer_code || defaultCustomerCode,
      gst_number: obj.gstin || null,
      pan_number: obj.pan || null,
      address: obj.city || null,
      is_active: true
    };
  });
}
