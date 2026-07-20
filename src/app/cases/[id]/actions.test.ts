import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleProgressStage,
  handleAssignTask,
  handleWithdraw,
  handleCompleteTask,
  handleForceReadyStage,
  handleToggleWaiting,
  handleChangePersona,
  handleCreateApprovalRound,
  handleApprovalDecision,
  handleSaveOutcome,
  handleAddComment,
  handleSelectiveUnlock,
  handleCounterOffer
} from './actions';
import * as auth from '@/utils/auth';
import * as engine from '@/utils/engine';
import * as scoring from '@/utils/scoring';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn)
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => {
      const builder = {
        update: vi.fn().mockImplementation((...args) => {
          const res = mockUpdate(...args);
          if (res) return res;
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
        order: vi.fn().mockImplementation(() => builder),
        limit: vi.fn().mockImplementation(() => builder),
        single: vi.fn().mockImplementation((...args) => {
          return mockSingle(...args);
        }),
        maybeSingle: vi.fn().mockImplementation((...args) => {
          return mockSingle(...args);
        }),
        insert: vi.fn().mockImplementation((...args) => {
          mockInsert(...args);
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
  hasRole: vi.fn(),
  isAdmin: vi.fn(),
  checkIsAdmin: vi.fn().mockReturnValue(true), // Avoid deep mock logic for task completion roles right now
  logAuditEvent: vi.fn(),
}));

vi.mock('@/utils/engine', () => ({
  progressStage: vi.fn(),
  withdrawCase: vi.fn(),
  setWaiting: vi.fn(),
}));

vi.mock('@/utils/scoring', () => ({
  updateCycleScore: vi.fn(),
}));

describe('cases/[id]/actions.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockSingle.mockReset();
    mockInsert.mockReset();
  });

  const formData = (data: Record<string, string>) => {
    const fd = new FormData();
    for (const key in data) {
      fd.append(key, data[key]);
    }
    return fd;
  };

  describe('handleProgressStage', () => {
    it('throws if not authenticated', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(null);
      vi.mocked(redirect).mockImplementationOnce(() => { throw new Error('redirected'); });
      await expect(handleProgressStage(formData({ caseId: '1', cycleId: '1', currentStage: '1' })))
        .rejects.toThrow('redirected');
    });

    it('progresses stage successfully', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['founder_admin'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      await handleProgressStage(formData({ caseId: 'c1', cycleId: 'cy1', currentStage: '1' }));

      expect(engine.progressStage).toHaveBeenCalledWith('cy1', 1, 'u1');
      expect(revalidatePath).toHaveBeenCalledWith('/cases/c1');
    });
  });

  describe('handleWithdraw', () => {
    it('withdraws successfully', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['rm'] } as any);
      vi.mocked(redirect).mockImplementationOnce(() => { throw new Error('redirected'); });

      await expect(handleWithdraw(formData({ caseId: 'c1', reason: 'Lost', note: 'Note' }))).rejects.toThrow('redirected');

      expect(engine.withdrawCase).toHaveBeenCalledWith({
        caseId: 'c1',
        reason: 'Lost',
        note: 'Note',
        actorId: 'u1',
      });
    });
  });

  describe('handleToggleWaiting', () => {
    it('sets waiting on case', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['kam'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      mockUpdate.mockReturnValue({ eq: mockEq } as any);
      mockEq.mockReturnValue(undefined);

      await handleToggleWaiting(formData({ caseId: 'c1', isWaiting: 'false', reason: 'input needed' }));

      expect(engine.setWaiting).toHaveBeenCalledWith({
        type: 'case',
        id: 'c1',
        reason: 'input needed',
        actorId: 'u1',
        caseId: 'c1'
      });
    });

    it('stops waiting on case', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['kam'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      mockUpdate.mockReturnValue({ eq: mockEq } as any);
      mockEq.mockResolvedValue({ error: null });

      await handleToggleWaiting(formData({ caseId: 'c1', isWaiting: 'true' }));

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'In Review', substatus: null });
    });
  });

  describe('handleCompleteTask', () => {
    it('completes task and updates score', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['rm'] } as any);

      mockEq.mockReturnValueOnce({ single: mockSingle } as any);
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 't1',
          review_cycle_id: 'cy1',
          param: { default_owning_role: 'rm' }
        }
      });

      mockUpdate.mockReturnValue({ eq: mockEq } as any);
      mockEq.mockResolvedValue({ error: null });

      await handleCompleteTask(formData({
        caseId: 'c1', taskId: 't1', cycleId: 'cy1',
        rawInput: '5', gradeValue: '5', reasonNote: 'ok'
      }));

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'Completed',
        completed_by: 'u1',
        completed_at: expect.any(String),
        grade_value: 5,
        reason: 'ok'
      }));
      expect(scoring.updateCycleScore).toHaveBeenCalledWith('cy1');
    });
  });

  describe('handleApprovalDecision founder credit-days override', () => {
    it('rejects override fields from a non-founder approver', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['ordinary_approver'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      vi.spyOn(auth, 'isAdmin').mockReturnValue(false);

      await expect(handleApprovalDecision(formData({
        caseId: 'c1',
        roundId: 'r1',
        decision: 'approve',
        overrideCreditDays: '60',
        overrideReason: 'Strategic exception',
      }))).rejects.toThrow(/Only Founder Admin/);

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('requires the founder override to exceed the policy recommendation', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'founder-1', roles: ['founder_admin'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      vi.spyOn(auth, 'isAdmin').mockReturnValue(true);
      mockSingle
        .mockResolvedValueOnce({ data: { review_cycle_id: 'cy1', status: 'open' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'cy1', case_id: 'c1', approved_credit_days: 30 }, error: null });

      await expect(handleApprovalDecision(formData({
        caseId: 'c1',
        roundId: 'r1',
        decision: 'approve',
        overrideCreditDays: '30',
        overrideReason: 'Strategic exception',
      }))).rejects.toThrow(/higher than the policy recommendation of 30 days/);

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('records and audits a valid founder override', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'founder-1', roles: ['founder_admin'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      vi.spyOn(auth, 'isAdmin').mockReturnValue(true);
      mockEq.mockImplementation((column) => column === 'approval_round_id' ? { data: [{ decision: 'approve' }] } : undefined);
      mockSingle
        .mockResolvedValueOnce({ data: { review_cycle_id: 'cy1', status: 'open' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'cy1', case_id: 'c1', approved_credit_days: 30 }, error: null })
        .mockResolvedValueOnce({ data: { review_cycle_id: 'cy1' }, error: null })
        .mockResolvedValueOnce({ data: { policy_snapshot_id: 'policy-1', score_band_name: 'A' }, error: null })
        .mockResolvedValueOnce({ data: { case_scenario: 'customer_name_customer_pays' }, error: null })
        .mockResolvedValueOnce({ data: { case_number: 'CASE-1', rm_user_id: null }, error: null });

      await handleApprovalDecision(formData({
        caseId: 'c1',
        roundId: 'r1',
        decision: 'approve',
        overrideCreditDays: '60',
        overrideReason: 'Strategic account with secured receivables',
      }));

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        decision: 'approved',
        approved_credit_days: 60,
      }));
      expect(auth.logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'founder_credit_days_override',
        actor_id: 'founder-1',
        metadata: expect.objectContaining({
          policy_recommended_credit_days: 30,
          founder_override_credit_days: 60,
        }),
      }));
    });
  });

  describe('handleChangePersona', () => {
    it('changes persona successfully', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['kam'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      // mock the review_cycles single fetch
      mockEq.mockReturnValueOnce({ single: mockSingle } as any);
      mockSingle.mockResolvedValueOnce({ data: { policy_snapshot_id: 'pol1', current_case_score: 62, score_band_name: 'B' } });

      // mock the persona single fetch
      mockEq.mockReturnValueOnce({ single: mockSingle } as any);
      mockSingle.mockResolvedValueOnce({ data: { policy_version_id: 'pol1' } });
      mockSingle.mockResolvedValueOnce({ data: { current_case_score: 71, score_band_name: 'A' } });

      mockUpdate.mockReturnValue({ eq: mockEq } as any);
      mockEq.mockReturnValue(undefined);

      await handleChangePersona(formData({
        caseId: 'c1', cycleId: 'cy1',
        subjectType: 'customer', customerPersonaId: 'p1'
      }));

      expect(mockUpdate).toHaveBeenCalledWith({ customer_persona_id: 'p1', contractor_persona_id: null, dominance_category_id: null });
      expect(scoring.updateCycleScore).toHaveBeenCalledWith('cy1');
      expect(auth.logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('62 → 71') }));
    });
  });

  describe('handleCompleteTask yes/no mapping', () => {
    it('maps the raw Yes value through the configured parameter mapping', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['rm'] } as any);
      mockEq.mockReturnValueOnce({ single: mockSingle } as any);
      mockSingle.mockResolvedValueOnce({ data: {
        id: 't1', review_cycle_id: 'cy1',
        param: { default_owning_role: 'rm', input_type: 'yes_no', auto_band_config: { mappings: [{ value: 'Yes', grade: 5 }, { value: 'No', grade: 1 }] } },
      } });
      mockUpdate.mockReturnValue({ eq: mockEq } as any);
      mockEq.mockResolvedValue({ error: null });

      await handleCompleteTask(formData({ caseId: 'c1', taskId: 't1', rawInput: 'Yes' }));

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ grade_value: 5, raw_input_value: 'Yes' }));
    });
  });

  describe('handleCreateApprovalRound', () => {
    it('creates approval round', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['kam'] } as any);

      mockUpdate.mockReturnValue({ eq: mockEq } as any);
      mockEq.mockResolvedValue({ error: null });

      mockInsert.mockResolvedValueOnce({ error: null });

      await handleCreateApprovalRound(formData({
        caseId: 'c1', cycleId: 'cy1', stage: '2', roundType: 'ordinary'
      }));

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'Awaiting Approval' });
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        review_cycle_id: 'cy1', stage: 2, round_type: 'ordinary'
      }));
    });
  });
});
