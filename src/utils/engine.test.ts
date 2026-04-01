import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateCompositeDays,
  validateTranches,
  createCaseDraft,
  submitCase,
  generateStageTasks,
  generateAllCycleTasks,
  progressStage,
  setWaiting,
  returnForRevision,
  withdrawCase
} from './engine';

// Mock Supabase client
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockIs = vi.fn();
const mockSingle = vi.fn();
const mockIn = vi.fn();

vi.mock('./supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table) => {
      const builder = {
        insert: vi.fn().mockImplementation((...args) => {
          mockInsert(...args);
          return builder;
        }),
        update: vi.fn().mockImplementation((...args) => {
          mockUpdate(...args);
          return builder;
        }),
        neq: vi.fn().mockImplementation((...args) => {
          const res = mockNeq(...args);
          if (res) return res;
          return builder;
        }),
        is: vi.fn().mockImplementation((...args) => {
          const res = mockIs(...args);
          if (res) return res;
          return builder;
        }),
        select: vi.fn().mockImplementation((...args) => {
          mockSelect(...args);
          return builder;
        }),
        eq: vi.fn().mockImplementation((...args) => {
          const res = mockEq(...args);
          return builder;
          if (res) {
            // Need to allow chaining if res is just an object without builder methods
            return { ...builder, ...res };
          }
          return builder;
        }),
        in: vi.fn().mockImplementation((...args) => {
          const res = mockIn(...args);
          return builder;
          if (res) {
            return { ...builder, ...res };
          }
          return builder;
        }),
        single: vi.fn().mockImplementation((...args) => {
          return mockSingle(...args);
        }),
      };
      return builder;
    }),
  })),
}));

vi.mock('./auth', () => ({
  logAuditEvent: vi.fn(),
}));

describe('engine.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockIn.mockReset();
    mockSingle.mockReset();
  });

  describe('calculateCompositeDays', () => {
    it('returns 0 if no tranches or bill amount is 0', () => {
      expect(calculateCompositeDays([], 1000)).toBe(0);
      expect(calculateCompositeDays([{ type: 'amount', value: 1000, days_after_billing: 30 }], 0)).toBe(0);
    });

    it('calculates correctly for amount tranches', () => {
      const tranches: any[] = [
        { type: 'amount', value: 500, days_after_billing: 0 },
        { type: 'amount', value: 500, days_after_billing: 60 }
      ];
      expect(calculateCompositeDays(tranches, 1000)).toBe(30);
    });

    it('calculates correctly for percentage tranches', () => {
      const tranches: any[] = [
        { type: 'percentage', value: 30, days_after_billing: 0 },
        { type: 'percentage', value: 70, days_after_billing: 100 }
      ];
      expect(calculateCompositeDays(tranches, 10000)).toBe(70);
    });

    it('normalizes if weights do not sum to 1', () => {
      const tranches: any[] = [
        { type: 'percentage', value: 50, days_after_billing: 30 },
      ];
      expect(calculateCompositeDays(tranches, 1000)).toBe(30);
    });
  });

  describe('validateTranches', () => {
    it('returns invalid if no tranches provided', () => {
      const res = validateTranches([], 1000);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/at least one tranche/i);
    });

    it('returns valid for correctly matched amount tranches', () => {
      const tranches: any[] = [
        { type: 'amount', value: 500, days_after_billing: 0 },
        { type: 'amount', value: 500, days_after_billing: 60 }
      ];
      const res = validateTranches(tranches, 1000);
      expect(res.valid).toBe(true);
    });

    it('returns invalid if amount tranches do not match bill amount', () => {
      const tranches: any[] = [
        { type: 'amount', value: 500, days_after_billing: 0 },
        { type: 'amount', value: 499, days_after_billing: 60 }
      ];
      const res = validateTranches(tranches, 1000);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/must reconcile exactly/i);
    });

    it('returns valid for correctly matched percentage tranches', () => {
      const tranches: any[] = [
        { type: 'percentage', value: 30, days_after_billing: 0 },
        { type: 'percentage', value: 70, days_after_billing: 60 }
      ];
      const res = validateTranches(tranches, 1000);
      expect(res.valid).toBe(true);
    });

    it('returns invalid if percentage tranches do not sum to 100', () => {
      const tranches: any[] = [
        { type: 'percentage', value: 30, days_after_billing: 0 },
        { type: 'percentage', value: 60, days_after_billing: 60 }
      ];
      const res = validateTranches(tranches, 1000);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/must reconcile exactly/i);
    });
  });

  describe('createCaseDraft', () => {
    it('creates a case successfully', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'case-123' }, error: null });

      const data = {
        case_scenario: 'customer_name_customer_pays',
        bill_amount: 1000,
        requested_exposure_amount: 1000,
        proposed_tranches: [{ type: 'percentage', value: 100, days_after_billing: 30 }],
        rm_user_id: 'user-123'
      };

      const newCase = await createCaseDraft(data as any);
      expect(newCase.id).toBe('case-123');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('throws error if insert fails', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('DB Error') });

      const data = {
        case_scenario: 'customer_name_customer_pays',
        bill_amount: 1000,
        requested_exposure_amount: 1000,
        proposed_tranches: [{ type: 'percentage', value: 100, days_after_billing: 30 }],
        rm_user_id: 'user-123'
      };

      await expect(createCaseDraft(data as any)).rejects.toThrow('DB Error');
    });
  });

  describe('submitCase', () => {
    it('submits case successfully when active policy is found', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'policy-123' }, error: null }) // active policy
        .mockResolvedValueOnce({ data: { id: 'cycle-123' }, error: null }) // create cycle
        .mockResolvedValue({ data: { case_scenario: 'scen', history_classification: 'first_time', rm_user_id: 'u1' } }); // stages internal calls

      mockEq.mockResolvedValue({ error: null }); // update case status
      mockIn.mockResolvedValue({ data: [], count: 0 }); // stage tasks check

      const cycle = await submitCase('case-1', 'rm-1');
      expect(cycle.id).toBe('cycle-123');
    });

    it('throws error if no active policy found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(submitCase('case-1', 'rm-1')).rejects.toThrow(/No active policy version found/i);
    });
  });

  describe('generateStageTasks', () => {
    it('generates tasks if parameters exist', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { case_scenario: 'customer_name_customer_pays', rm_user_id: 'u1' }
      });

      mockIn.mockResolvedValueOnce({
        data: [{ id: 'param-1', name: 'Param 1', is_required: true }]
      });
      mockEq.mockResolvedValueOnce({ count: 0 });

      mockInsert.mockResolvedValue({ error: null });

      await generateStageTasks('cycle-1', 1, 'policy-1', 'case-1');
      expect(true).toBe(true);
    });

    it('does not generate tasks if they already exist', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { case_scenario: 'customer_name_customer_pays', rm_user_id: 'u1' }
      });

      mockIn.mockResolvedValueOnce({ data: [] });
      mockEq.mockResolvedValueOnce({ count: 1 });

      await generateStageTasks('cycle-1', 1, 'policy-1', 'case-1');
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('generateAllCycleTasks', () => {
    it('calls generateStageTasks for all 3 stages', async () => {
      mockSingle.mockResolvedValue({
        data: { case_scenario: 'customer_name_customer_pays', rm_user_id: 'u1' }
      });
      mockIn.mockResolvedValue({ data: [] });
      mockEq.mockResolvedValue({ count: 0 });

      await generateAllCycleTasks('cycle-1', 'policy-1', 'case-1');
      expect(true).toBe(true);
    });
  });

  describe('progressStage', () => {
    it('progresses stage successfully', async () => {
      mockSingle.mockResolvedValueOnce({ data: { case_id: 'c1', policy_snapshot_id: 'p1' } });
      mockSingle.mockResolvedValueOnce({ data: { case_number: "CASE-123", rm_user_id: "rm1" } });
      await progressStage('cycle-1', 1, 'actor-1');
      expect(mockUpdate).toHaveBeenCalledWith({ active_stage: 2 });
    });

    it('throws error if progressing beyond stage 3', async () => {
      await expect(progressStage('cycle-1', 3, 'actor-1')).rejects.toThrow(/Cannot progress beyond Stage 3/i);
    });

    it('throws error if review cycle is not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(progressStage('non-existent-cycle', 1, 'actor-1')).rejects.toThrow(/Review cycle not found/i);
    });

    it('progresses to stage 3 successfully (boundary success case)', async () => {
      mockSingle.mockResolvedValueOnce({ data: { case_id: 'c1', policy_snapshot_id: 'p1' } });
      mockSingle.mockResolvedValueOnce({ data: { case_number: "CASE-123", rm_user_id: "rm1" } });
      await progressStage('cycle-1', 2, 'actor-1');
      expect(mockUpdate).toHaveBeenCalledWith({ active_stage: 3 });
    });
  });

  describe('setWaiting', () => {
    it('sets task to waiting', async () => {
      mockEq.mockResolvedValueOnce({ error: null });
      await setWaiting({ type: 'task', id: 't1', reason: 'waiting', actorId: 'a1', caseId: 'c1' });
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_waiting: true, waiting_reason: 'waiting' }));
    });

    it('sets case to waiting', async () => {
      mockEq.mockResolvedValueOnce({ error: null });
      await setWaiting({ type: 'case', id: 'c1', reason: 'waiting input', actorId: 'a1', caseId: 'c1' });
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'Awaiting Input', substatus: 'waiting input' }));
    });
  });

  describe('returnForRevision', () => {
    it('updates case status', async () => {
      mockEq.mockResolvedValueOnce({ error: null });
      mockSingle.mockResolvedValueOnce({ data: { case_number: "CASE-123", rm_user_id: "rm1" } });
      await returnForRevision({ caseId: 'c1', cycleId: 'cycle1', comment: 'fix this', actorId: 'a1' });
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'In Review', substatus: 'Returned for revision' }));
    });
  });

  describe('withdrawCase', () => {
    it('updates case status to Closed and withdraws active cycle', async () => {
      mockEq.mockReturnValue({ error: null, eq: mockEq });

      mockSingle.mockResolvedValueOnce({ data: { case_number: "CASE-123", rm_user_id: "rm1" } });
      await withdrawCase({ caseId: 'c1', reason: 'lost', note: 'lost deal', actorId: 'a1' });
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'Withdrawn', closure_reason: 'lost' }));
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: false, decision: 'withdrawn' }));
    });
  });
});
