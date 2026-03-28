import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateSubjectScore,
  calculateCumulativeScore,
  calculateFinalCaseScore,
  mapScoreToCreditDays,
  checkAmbiguity,
} from '@/utils/scoring';

// Mock the server client to bypass Next.js cookies and actual DB hits
vi.mock('@/utils/supabase/server', () => {
  return {
    createClient: vi.fn(),
  };
});

import { createClient } from '@/utils/supabase/server';

describe('scoring utils', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.resetAllMocks();

    // Create a chainable mock interface for Supabase
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    (createClient as any).mockResolvedValue(mockSupabase);
  });

  describe('mapScoreToCreditDays', () => {
    it('returns null if no bands exist', async () => {
      mockSupabase.order.mockResolvedValue({ data: null });
      const result = await mapScoreToCreditDays({ policyVersionId: 'v1', score: 85 });
      expect(result).toBeNull();
    });

    it('matches the correct score band', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [
          { min_score: 90, max_score: 100, band_name: 'Excellent', approved_credit_days: 30, is_ambiguity_band: false },
          { min_score: 70, max_score: 89, band_name: 'Good', approved_credit_days: 15, is_ambiguity_band: false },
        ]
      });

      const result = await mapScoreToCreditDays({ policyVersionId: 'v1', score: 85 });
      expect(result).toEqual({ bandName: 'Good', approvedDays: 15, isAmbiguity: false });
    });

    it('returns null if score does not fit any band', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [
          { min_score: 90, max_score: 100, band_name: 'Excellent', approved_credit_days: 30, is_ambiguity_band: false }
        ]
      });

      const result = await mapScoreToCreditDays({ policyVersionId: 'v1', score: 50 });
      expect(result).toBeNull();
    });
  });

  describe('checkAmbiguity', () => {
    it('returns not ambiguous when score is good and no missing criticals', async () => {
      // Mock score bands query (ambiguity = false)
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { min_score: 70, max_score: 100, band_name: 'Clear', approved_credit_days: 30, is_ambiguity_band: false },
        ]
      });
      // Mock incomplete tasks query (none)
      const mockIs = vi.fn().mockResolvedValue({ data: [] });

      mockSupabase.order = mockOrder;
      mockSupabase.is = mockIs;

      const result = await checkAmbiguity({ reviewCycleId: 'cycle-1', policyVersionId: 'v1', score: 85 });

      expect(result.isAmbiguous).toBe(false);
      expect(result.reasons.length).toBe(0);
    });

    it('returns ambiguous if score falls in ambiguity band', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { min_score: 0, max_score: 50, band_name: 'Review Needed', approved_credit_days: 0, is_ambiguity_band: true },
        ]
      });
      const mockIs = vi.fn().mockResolvedValue({ data: [] });

      mockSupabase.order = mockOrder;
      mockSupabase.is = mockIs;

      const result = await checkAmbiguity({ reviewCycleId: 'cycle-1', policyVersionId: 'v1', score: 40 });

      expect(result.isAmbiguous).toBe(true);
      expect(result.reasons[0]).toContain('Review Needed');
    });

    it('returns ambiguous if critical parameters are incomplete', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { min_score: 70, max_score: 100, band_name: 'Clear', approved_credit_days: 30, is_ambiguity_band: false },
        ]
      });

      const mockIs = vi.fn().mockResolvedValue({
        data: [
          { parameter: { name: 'Financials', is_critical: true } }
        ]
      });

      mockSupabase.order = mockOrder;
      mockSupabase.is = mockIs;

      const result = await checkAmbiguity({ reviewCycleId: 'cycle-1', policyVersionId: 'v1', score: 85 });

      expect(result.isAmbiguous).toBe(true);
      expect(result.reasons[0]).toContain('1 critical parameter(s) are incomplete');
    });
  });
});
