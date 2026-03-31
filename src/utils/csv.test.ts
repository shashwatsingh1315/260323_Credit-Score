import { describe, it, expect } from 'vitest';
import { parsePartiesCsv } from './csv';

describe('parsePartiesCsv', () => {
  it('correctly parses a valid CSV', () => {
    const csvContent = 'legal_name,customer_code,gstin,pan,city\nAcme Corp,CUST-001,GST-001,PAN-001,New York';
    const result = parsePartiesCsv(csvContent);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      legal_name: 'Acme Corp',
      customer_code: 'CUST-001',
      gst_number: 'GST-001',
      pan_number: 'PAN-001',
      address: 'New York',
      is_active: true
    });
  });

  it('handles missing optional fields by providing defaults or nulls', () => {
    const csvContent = 'legal_name\nSmall Business';
    const result = parsePartiesCsv(csvContent);

    expect(result).toHaveLength(1);
    expect(result[0].legal_name).toBe('Small Business');
    expect(result[0].customer_code).toMatch(/^CUST-IMP-\d+$/);
    expect(result[0].gst_number).toBeNull();
    expect(result[0].pan_number).toBeNull();
    expect(result[0].address).toBeNull();
  });

  it('normalizes headers to lowercase', () => {
    const csvContent = 'LEGAL_NAME,CUSTOMER_CODE\nBIG CORP,CUST-BIG';
    const result = parsePartiesCsv(csvContent);

    expect(result).toHaveLength(1);
    expect(result[0].legal_name).toBe('BIG CORP');
    expect(result[0].customer_code).toBe('CUST-BIG');
  });

  it('throws an error for empty CSV', () => {
    expect(() => parsePartiesCsv('')).toThrow('CSV is empty or missing headers');
  });

  it('throws an error for invalid CSV format', () => {
    expect(() => parsePartiesCsv('\n\n\n')).toThrow('CSV is empty or missing headers');
  });
});
