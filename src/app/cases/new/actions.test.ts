import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleNewCase,
  fetchParties,
  fetchBranches,
  fetchActiveRoutingThresholds,
  fetchEnumerations,
  fetchRmIntakeTasks
} from './actions';
import * as auth from '@/utils/auth';
import * as engine from '@/utils/engine';
import { redirect } from 'next/navigation';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockIn = vi.fn();

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => {
      const builder = {
        select: vi.fn().mockImplementation((...args) => {
          mockSelect(...args);
          return builder;
        }),
        eq: vi.fn().mockImplementation((...args) => {
          const res = mockEq(...args);
          if (res) return res;
          return builder;
        }),
        order: vi.fn().mockImplementation((...args) => {
          const res = mockOrder(...args);
          if (res) return res;
          return builder;
        }),
        limit: vi.fn().mockImplementation((...args) => {
          const res = mockLimit(...args);
          if (res) return res;
          return builder;
        }),
        single: vi.fn().mockImplementation((...args) => {
          return mockSingle(...args);
        }),
        in: vi.fn().mockImplementation((...args) => {
          const res = mockIn(...args);
          if (res) return res;
          return builder;
        }),
      };
      return builder;
    }),
  })),
}));

vi.mock('@/utils/auth', () => ({
  getCurrentUser: vi.fn(),
  hasAnyRole: vi.fn(),
  isAdmin: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock('@/utils/engine', () => ({
  createCaseDraft: vi.fn(),
  submitCase: vi.fn(),
  validateTranches: vi.fn(),
  calculateCompositeDays: vi.fn(),
}));

describe('cases/new/actions.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockOrder.mockReset();
    mockLimit.mockReset();
    mockSingle.mockReset();
    mockIn.mockReset();
  });

  describe('handleNewCase', () => {
    it('redirects to login if user not authenticated', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(null);
      vi.mocked(redirect).mockImplementationOnce(() => { throw new Error('redirected'); });

      await expect(handleNewCase(new FormData())).rejects.toThrow('redirected');
      expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('throws error if user is not rm or founder_admin', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['bdo'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(false);

      await expect(handleNewCase(new FormData())).rejects.toThrow(/Only RM or Admin/);
    });

    it('throws error for invalid tranche data', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['rm'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      const formData = new FormData();
      formData.append('tranches', 'invalid-json');

      await expect(handleNewCase(formData)).rejects.toThrow(/Invalid tranche data/);
    });

    it('creates draft case successfully', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['rm'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      const draftMock = vi.spyOn(engine, 'createCaseDraft').mockResolvedValue({ id: 'case-123' } as any);

      const formData = new FormData();
      formData.append('caseScenario', 'scen1');
      formData.append('billAmount', '1000');
      formData.append('action', 'draft');

      await handleNewCase(formData);

      expect(draftMock).toHaveBeenCalledWith(expect.objectContaining({
        case_scenario: 'scen1',
        bill_amount: 1000,
        rm_user_id: 'u1'
      }));
      expect(redirect).toHaveBeenCalledWith('/cases/case-123');
    });

    it('creates and submits case successfully', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['rm'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      const draftMock = vi.spyOn(engine, 'createCaseDraft').mockResolvedValue({ id: 'case-123' } as any);
      const submitMock = vi.spyOn(engine, 'submitCase').mockResolvedValue({} as any);
      vi.spyOn(engine, 'validateTranches').mockReturnValue({ valid: true });

      const formData = new FormData();
      formData.append('caseScenario', 'scen1');
      formData.append('billAmount', '1000');
      formData.append('action', 'submit');

      await handleNewCase(formData);

      expect(draftMock).toHaveBeenCalled();
      expect(submitMock).toHaveBeenCalledWith('case-123', 'u1');
      expect(redirect).toHaveBeenCalledWith('/cases/case-123');
    });

    it('throws error if tranches are invalid when submitting', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['rm'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      vi.spyOn(engine, 'validateTranches').mockReturnValue({ valid: false, error: 'Validation failed' });

      const formData = new FormData();
      formData.append('action', 'submit');
      formData.append('billAmount', '1000');

      await expect(handleNewCase(formData)).rejects.toThrow(/Validation failed/);
    });
  });

  describe('fetchParties', () => {
    it('returns parties', async () => {
      mockLimit.mockResolvedValue({ data: [{ id: 'p1' }] });
      const res = await fetchParties();
      expect(res).toEqual([{ id: 'p1' }]);
    });
  });

  describe('fetchBranches', () => {
    it('returns branches', async () => {
      mockOrder.mockResolvedValue({ data: [{ id: 'b1' }] });
      const res = await fetchBranches();
      expect(res).toEqual([{ id: 'b1' }]);
    });
  });

  describe('fetchActiveRoutingThresholds', () => {
    it('returns empty if no active policy', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });
      const res = await fetchActiveRoutingThresholds();
      expect(res).toEqual([]);
    });

    it('returns thresholds if active policy exists', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'pol1' } });
      mockOrder.mockResolvedValueOnce({ data: [{ id: 't1' }] });

      const res = await fetchActiveRoutingThresholds();
      expect(res).toEqual([{ id: 't1' }]);
    });
  });

  describe('fetchEnumerations', () => {
    it('returns enumerations by category', async () => {
      mockOrder.mockResolvedValue({ data: [{ value: 'Product A' }] });
      const res = await fetchEnumerations('category1');
      expect(res).toEqual([{ value: 'Product A' }]);
    });
  });

  describe('fetchRmIntakeTasks', () => {
    it('returns empty if no active policy', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });
      const res = await fetchRmIntakeTasks('scen1');
      expect(res).toEqual([]);
    });

    it('returns rm specific parameters', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'pol1' } });
      mockIn.mockResolvedValueOnce({
        data: [
          { id: 'param1', default_owning_role: 'rm', conditional_rules: {} },
          { id: 'param2', default_owning_role: 'kam', conditional_rules: {} },
          { id: 'param3', default_owning_role: 'rm', conditional_rules: { scenarios: ['other_scenario'] } }
        ]
      });

      const res = await fetchRmIntakeTasks('test_scenario');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('param1');
    });
  });
});
