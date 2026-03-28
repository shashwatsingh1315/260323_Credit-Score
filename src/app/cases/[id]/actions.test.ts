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
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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
        single: vi.fn().mockImplementation((...args) => {
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
      mockEq.mockResolvedValue({ error: null });

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
        rawInput: '5', gradeValue: '5', reason: 'ok'
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

  describe('handleChangePersona', () => {
    it('changes persona successfully', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: 'u1', roles: ['kam'] } as any);
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      // mock the review_cycles single fetch
      mockEq.mockReturnValueOnce({ single: mockSingle } as any);
      mockSingle.mockResolvedValueOnce({ data: { policy_snapshot_id: 'pol1' } });

      // mock the persona single fetch
      mockEq.mockReturnValueOnce({ single: mockSingle } as any);
      mockSingle.mockResolvedValueOnce({ data: { policy_version_id: 'pol1' } });

      mockUpdate.mockReturnValue({ eq: mockEq } as any);
      mockEq.mockResolvedValue({ error: null });

      await handleChangePersona(formData({
        caseId: 'c1', cycleId: 'cy1',
        subjectType: 'customer', customerPersonaId: 'p1'
      }));

      expect(mockUpdate).toHaveBeenCalledWith({ customer_persona_id: 'p1', contractor_persona_id: null, dominance_category_id: null });
      expect(scoring.updateCycleScore).toHaveBeenCalledWith('cy1');
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
