import { describe, it, expect } from 'vitest';
import { calculateCompositeDays, validateTranches } from '@/utils/engine';

describe('engine utils', () => {
  describe('calculateCompositeDays', () => {
    it('returns 0 for empty tranches or 0 bill amount', () => {
      expect(calculateCompositeDays([], 1000)).toBe(0);
      expect(calculateCompositeDays([{ type: 'percentage', value: 100, days_after_billing: 30 }], 0)).toBe(0);
    });

    it('calculates correctly for percentage tranches', () => {
      const tranches: any[] = [
        { type: 'percentage', value: 50, days_after_billing: 30 },
        { type: 'percentage', value: 50, days_after_billing: 60 },
      ];
      // 0.5 * 30 + 0.5 * 60 = 15 + 30 = 45
      expect(calculateCompositeDays(tranches, 1000)).toBe(45);
    });

    it('calculates correctly for amount tranches', () => {
      const tranches: any[] = [
        { type: 'amount', value: 200, days_after_billing: 10 },
        { type: 'amount', value: 800, days_after_billing: 40 },
      ];
      // 200/1000 = 0.2 weight, 800/1000 = 0.8 weight
      // 0.2 * 10 + 0.8 * 40 = 2 + 32 = 34
      expect(calculateCompositeDays(tranches, 1000)).toBe(34);
    });

    it('normalizes if weights do not sum to 1', () => {
      const tranches: any[] = [
        { type: 'percentage', value: 30, days_after_billing: 10 },
        { type: 'percentage', value: 30, days_after_billing: 20 },
      ];
      // total weight = 0.6
      // raw weighted days = 0.3 * 10 + 0.3 * 20 = 3 + 6 = 9
      // normalized = 9 / 0.6 = 15
      expect(calculateCompositeDays(tranches, 1000)).toBe(15);
    });
  });

  describe('validateTranches', () => {
    it('returns invalid for empty tranches', () => {
      const result = validateTranches([], 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one tranche is required');
    });

    it('returns valid for correct amount reconciliation', () => {
      const tranches: any[] = [
        { type: 'amount', value: 300, days_after_billing: 10 },
        { type: 'amount', value: 700, days_after_billing: 30 },
      ];
      const result = validateTranches(tranches, 1000);
      expect(result.valid).toBe(true);
    });

    it('returns valid for correct percentage reconciliation', () => {
      const tranches: any[] = [
        { type: 'percentage', value: 25, days_after_billing: 10 },
        { type: 'percentage', value: 75, days_after_billing: 30 },
      ];
      const result = validateTranches(tranches, 1000);
      expect(result.valid).toBe(true);
    });

    it('returns invalid if amounts do not match bill amount', () => {
      const tranches: any[] = [
        { type: 'amount', value: 300, days_after_billing: 10 },
        { type: 'amount', value: 600, days_after_billing: 30 },
      ];
      const result = validateTranches(tranches, 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reconcile exactly');
    });

    it('returns invalid if percentages do not match 100%', () => {
      const tranches: any[] = [
        { type: 'percentage', value: 50, days_after_billing: 10 },
        { type: 'percentage', value: 40, days_after_billing: 30 },
      ];
      const result = validateTranches(tranches, 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reconcile exactly');
    });
  });
});
