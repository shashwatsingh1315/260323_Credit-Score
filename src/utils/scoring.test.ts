import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateSubjectScore,
  calculateCumulativeScore,
  calculateFinalCaseScore,
  mapScoreToCreditDays,
  checkAmbiguity,
  updateCycleScore
} from './scoring';

// Mock Supabase client
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockNot = vi.fn();
const mockOrder = vi.fn();
const mockIs = vi.fn();

vi.mock('./supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => {
      const builder = {
        update: vi.fn().mockImplementation((...args) => {
          mockUpdate(...args);
          return builder;
        }),
        select: vi.fn().mockImplementation((...args) => {
          mockSelect(...args);
          return builder;
        }),
        eq: vi.fn().mockImplementation((...args) => {
          const res = mockEq(...args);
          if (res) return res;
          return builder;
        }),
        not: vi.fn().mockImplementation((...args) => {
          const res = mockNot(...args);
          if (res) return res;
          return builder;
        }),
        order: vi.fn().mockImplementation((...args) => {
          const res = mockOrder(...args);
          if (res) return res;
          return builder;
        }),
        is: vi.fn().mockImplementation((...args) => {
          const res = mockIs(...args);
          if (res) return res;
          return builder;
        }),
        single: vi.fn().mockImplementation((...args) => {
          return mockSingle(...args);
        }),
        maybeSingle: vi.fn().mockImplementation((...args) => {
          return mockSingle(...args);
        }),
      };
      return builder;
    }),
  })),
}));

describe('scoring.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockSingle.mockReset();
    mockNot.mockReset();
    mockOrder.mockReset();
    mockIs.mockReset();
  });

  describe('calculateSubjectScore', () => {
    it('returns 0 if cycle is not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });
      const score = await calculateSubjectScore({ reviewCycleId: '1', subjectType: 'customer', stage: 1 });
      expect(score).toBe(0);
    });

    it('returns 0 if no completed tasks exist', async () => {
      mockSingle.mockResolvedValueOnce({ data: { customer_persona_id: 'p1' } });
      mockNot.mockResolvedValueOnce({ data: [] });

      const score = await calculateSubjectScore({ reviewCycleId: '1', subjectType: 'customer', stage: 1 });
      expect(score).toBe(0);
    });

    it('calculates score using default weights', async () => {
      mockSingle.mockResolvedValueOnce({ data: { customer_persona_id: null } });
      mockNot.mockResolvedValueOnce({
        data: [
          { parameter_id: 'param1', grade_value: 5, parameter: { subject_type: 'customer', weight: 1 } },
          { parameter_id: 'param2', grade_value: 10, parameter: { subject_type: 'customer', weight: 2 } },
        ]
      });

      const score = await calculateSubjectScore({ reviewCycleId: '1', subjectType: 'customer', stage: 1 });
      expect(score).toBe(25); // 5*1 + 10*2 = 25
    });

    it('calculates score applying weight overrides from persona', async () => {
      // 1. fetch cycle
      mockSingle.mockResolvedValueOnce({ data: { customer_persona_id: 'p1' } });

      // 2. fetch tasks
      mockNot.mockResolvedValueOnce({
        data: [
          { parameter_id: 'param1', grade_value: 5, parameter: { subject_type: 'customer', weight: 1 } },
          { parameter_id: 'param2', grade_value: 10, parameter: { subject_type: 'customer', weight: 1 } },
        ]
      });

      // 3. fetch overrides
      mockEq.mockReturnValue({
        then: (resolve: any) => resolve({
          data: [
            { parameter_id: 'param1', weight: 2 },
          ]
        }),
        single: mockSingle,
        maybeSingle: mockSingle,
        not: mockNot,
        eq: mockEq,
      } as any);

      const score = await calculateSubjectScore({ reviewCycleId: '1', subjectType: 'customer', stage: 1 });
      expect(score).toBe(20);
    });
  });

  describe('calculateCumulativeScore', () => {
    it('returns 0 if cycle not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });
      const score = await calculateCumulativeScore({ reviewCycleId: '1', subjectType: 'customer', upToStage: 1 });
      expect(score).toBe(0);
    });

    it('normalizes calculated scores to max_total', async () => {
      // cycle for cumulative
      mockSingle.mockResolvedValueOnce({ data: { policy_snapshot_id: 'pol1', customer_persona_id: null } });

      // Stage 1 internal
      mockSingle.mockResolvedValueOnce({ data: { customer_persona_id: null } });
      mockNot.mockResolvedValueOnce({
        data: [
          { parameter_id: 'param1', grade_value: 10, parameter: { subject_type: 'customer', weight: 1 } },
        ]
      });

      // Stage 2 internal
      mockSingle.mockResolvedValueOnce({ data: { customer_persona_id: null } });
      mockNot.mockResolvedValueOnce({
        data: [
          { parameter_id: 'param2', grade_value: 5, parameter: { subject_type: 'customer', weight: 1 } },
        ]
      });

      // max_total query
      mockSingle.mockResolvedValueOnce({ data: { max_total: 50 } });

      const score = await calculateCumulativeScore({ reviewCycleId: '1', subjectType: 'customer', upToStage: 2 });
      expect(score).toBe(30); // (15 / 50) * 100
    });
  });

  describe('calculateFinalCaseScore', () => {
    it('applies customer_only combination', async () => {
      mockSingle.mockResolvedValue({ data: null });

      const res = await calculateFinalCaseScore({ reviewCycleId: '1', caseScenario: 'customer_name_customer_pays', upToStage: 3 });
      expect(res).toHaveProperty('finalScore');
    });
  });

  describe('mapScoreToCreditDays', () => {
    it('returns matching band', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [
          { min_score: 80, max_score: 100, band_name: 'A', approved_credit_days: 90, is_ambiguity_band: false },
          { min_score: 50, max_score: 79, band_name: 'B', approved_credit_days: 60, is_ambiguity_band: true }
        ]
      });

      const res = await mapScoreToCreditDays({ policyVersionId: 'pol1', score: 65 });
      expect(res).toEqual({ bandName: 'B', approvedDays: 60, isAmbiguity: true });
    });

    it('returns null if no band matches', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [
          { min_score: 80, max_score: 100, band_name: 'A', approved_credit_days: 90, is_ambiguity_band: false },
        ]
      });

      const res = await mapScoreToCreditDays({ policyVersionId: 'pol1', score: 20 });
      expect(res).toBeNull();
    });
  });

  describe('checkAmbiguity', () => {
    it('returns unambiguous if score is clear and no criticals missing', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [
          { min_score: 0, max_score: 100, band_name: 'A', approved_credit_days: 90, is_ambiguity_band: false },
        ]
      });
      mockIs.mockResolvedValueOnce({ data: [] });

      const res = await checkAmbiguity({ reviewCycleId: '1', policyVersionId: 'pol1', score: 50 });
      expect(res.isAmbiguous).toBe(false);
      expect(res.reasons).toHaveLength(0);
    });

    it('returns ambiguous if score in ambiguity band', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [
          { min_score: 0, max_score: 100, band_name: 'AmbigBand', approved_credit_days: 90, is_ambiguity_band: true },
        ]
      });
      mockIs.mockResolvedValueOnce({ data: [] });

      const res = await checkAmbiguity({ reviewCycleId: '1', policyVersionId: 'pol1', score: 50 });
      expect(res.isAmbiguous).toBe(true);
      expect(res.reasons[0]).toMatch(/falls in ambiguity band/);
    });

    it('returns ambiguous if missing critical parameters', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [
          { min_score: 0, max_score: 100, band_name: 'A', approved_credit_days: 90, is_ambiguity_band: false },
        ]
      });
      mockIs.mockResolvedValueOnce({
        data: [
          { parameter: { is_critical: true } },
          { parameter: { is_critical: false } }
        ]
      });

      const res = await checkAmbiguity({ reviewCycleId: '1', policyVersionId: 'pol1', score: 50 });
      expect(res.isAmbiguous).toBe(true);
      expect(res.reasons[0]).toMatch(/1 critical parameter\(s\) are incomplete/);
    });
  });

  describe('updateCycleScore', () => {
    it('executes without error', async () => {
      mockSingle.mockResolvedValue({ data: { credit_cases: { case_scenario: 'customer_name_customer_pays' } } });
      mockUpdate.mockResolvedValue({ error: null });

      await updateCycleScore('cycle1');
      expect(true).toBe(true);
    });
  });
});
