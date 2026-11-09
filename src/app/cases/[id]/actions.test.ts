import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleProgressStage,
  handleAssignTask,
  handleWithdraw,
  handleCompleteTask,
  handleForceReadyStage,
  handleSubmitStage,
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

// Test-only cast for mock return values. The mocked Supabase, auth and engine
// results are partial fixtures, so each stub is deliberately not the full type.
const stub = (value: object) => value as never;

const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
// Result of an awaited `.limit(n)` query (array rows), e.g. the open-round and own-decision guards.
const mockRows = vi.fn(() => ({ data: [], error: null }));
const mockDelete = vi.fn(() => ({ error: null }));
// Awaited result of an insert chain (e.g. board_rounds insert); the approval round insert chains on .select().single().
const mockInsertResult = vi.fn(() => ({ error: null }));

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
        // Returns a limited builder: further chaining (.maybeSingle) still goes to mockSingle,
        // while awaiting it directly resolves to the array result from mockRows.
        limit: vi.fn().mockImplementation(() => ({
          ...builder,
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(mockRows()).then(resolve, reject),
        })),
        delete: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockImplementation(() => mockDelete()),
        })),
        single: vi.fn().mockImplementation((...args) => {
          return mockSingle(...args);
        }),
        maybeSingle: vi.fn().mockImplementation((...args) => {
          return mockSingle(...args);
        }),
        insert: vi.fn().mockImplementation((...args) => {
          mockInsert(...args);
          return {
            ...builder,
            then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(mockInsertResult()).then(resolve, reject),
          };
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
    mockRows.mockReset();
    mockRows.mockImplementation(() => ({ data: [], error: null }));
    mockDelete.mockReset();
    mockDelete.mockImplementation(() => ({ error: null }));
    mockInsertResult.mockReset();
    mockInsertResult.mockImplementation(() => ({ error: null }));
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
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['founder_admin'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      await handleProgressStage(formData({ caseId: 'c1', cycleId: 'cy1', currentStage: '1' }));

      expect(engine.progressStage).toHaveBeenCalledWith('cy1', 1, 'u1');
      expect(revalidatePath).toHaveBeenCalledWith('/cases/c1');
    });
  });

  describe('handleWithdraw', () => {
    it('withdraws successfully', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
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
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['kam'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      mockUpdate.mockReturnValue(stub({ eq: mockEq }));
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
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['kam'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      mockUpdate.mockReturnValue(stub({ eq: mockEq }));
      mockEq.mockResolvedValue({ error: null });

      await handleToggleWaiting(formData({ caseId: 'c1', isWaiting: 'true' }));

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'In Review', substatus: null });
    });
  });

  describe('handleCompleteTask', () => {
    it('completes task and updates score', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));

      mockEq.mockReturnValueOnce(stub({ single: mockSingle }));
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 't1',
          review_cycle_id: 'cy1',
          param: { default_owning_role: 'rm' }
        }
      });
      // decision-freeze status read (review_cycles -> credit_cases)
      mockEq.mockReturnValueOnce(stub({ maybeSingle: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { credit_cases: { status: 'In Review' } }, error: null });

      mockUpdate.mockReturnValue(stub({ eq: mockEq }));
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
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['ordinary_approver'] }));
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
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'founder-1', roles: ['founder_admin'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      vi.spyOn(auth, 'isAdmin').mockReturnValue(true);
      mockSingle
        .mockResolvedValueOnce({ data: { review_cycle_id: 'cy1', status: 'open', round_type: 'ordinary' }, error: null })
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
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'founder-1', roles: ['founder_admin'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      vi.spyOn(auth, 'isAdmin').mockReturnValue(true);
      const approvedDecisions = {
        data: [{ decision: 'approve' }],
        eq: vi.fn(() => ({ maybeSingle: mockSingle, limit: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
      };
      mockEq.mockImplementation((column) => column === 'approval_round_id' ? approvedDecisions : undefined);
      mockSingle
        .mockResolvedValueOnce({ data: { review_cycle_id: 'cy1', status: 'open', round_type: 'ordinary' }, error: null })
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
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['kam'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      // decision-freeze status read (review_cycles -> credit_cases)
      mockEq.mockReturnValueOnce(stub({ maybeSingle: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { credit_cases: { status: 'In Review' } }, error: null });

      // mock the review_cycles single fetch
      mockEq.mockReturnValueOnce(stub({ single: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { policy_snapshot_id: 'pol1', current_case_score: 62, score_band_name: 'B' } });

      // mock the persona single fetch
      mockEq.mockReturnValueOnce(stub({ single: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { policy_version_id: 'pol1' } });
      mockSingle.mockResolvedValueOnce({ data: { current_case_score: 71, score_band_name: 'A' } });

      mockUpdate.mockReturnValue(stub({ eq: mockEq }));
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
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
      mockEq.mockReturnValueOnce(stub({ single: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: {
        id: 't1', review_cycle_id: 'cy1',
        param: { default_owning_role: 'rm', input_type: 'yes_no', auto_band_config: { mappings: [{ value: 'Yes', grade: 5 }, { value: 'No', grade: 1 }] } },
      } });
      // decision-freeze status read
      mockEq.mockReturnValueOnce(stub({ maybeSingle: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { credit_cases: { status: 'In Review' } }, error: null });
      mockUpdate.mockReturnValue(stub({ eq: mockEq }));
      mockEq.mockResolvedValue({ error: null });

      await handleCompleteTask(formData({ caseId: 'c1', taskId: 't1', rawInput: 'Yes' }));

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ grade_value: 5, raw_input_value: 'Yes' }));
    });
  });

  describe('decision packet freeze', () => {
    const queueTaskAndStatus = (status: string) => {
      mockEq.mockReturnValueOnce(stub({ single: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { id: 't1', review_cycle_id: 'cy1', task_type: 'scoring', param: { default_owning_role: 'rm' } } });
      mockEq.mockReturnValueOnce(stub({ maybeSingle: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { credit_cases: { status } }, error: null });
    };

    it('rejects grading a task while the case awaits a decision', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
      queueTaskAndStatus('Awaiting Approval');

      await expect(handleCompleteTask(formData({
        caseId: 'c1', taskId: 't1', rawInput: '5', gradeValue: '5',
      }))).rejects.toThrow(/locked while a decision round is open/);

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(scoring.updateCycleScore).not.toHaveBeenCalled();
    });

    it('rejects grading a task while the case is under appeal', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
      queueTaskAndStatus('Appealed');

      await expect(handleCompleteTask(formData({
        caseId: 'c1', taskId: 't1', rawInput: '5', gradeValue: '5',
      }))).rejects.toThrow(/locked while a decision round is open/);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('rejects a persona change while the case awaits a decision', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['kam'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      mockEq.mockReturnValueOnce(stub({ maybeSingle: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { credit_cases: { status: 'Awaiting Approval' } }, error: null });

      await expect(handleChangePersona(formData({
        caseId: 'c1', cycleId: 'cy1', customerPersonaId: 'p1',
      }))).rejects.toThrow(/locked while a decision round is open/);

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(scoring.updateCycleScore).not.toHaveBeenCalled();
    });

    it('rejects stage submission while the case awaits a decision', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['kam'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      mockEq.mockReturnValueOnce(stub({ maybeSingle: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { credit_cases: { status: 'Awaiting Approval' } }, error: null });

      await expect(handleSubmitStage(formData({
        caseId: 'c1', cycleId: 'cy1', currentStage: '3',
      }))).rejects.toThrow(/locked while a decision round is open/);

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('fails closed when the decision status cannot be read', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['kam'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      mockEq.mockReturnValueOnce(stub({ maybeSingle: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'db down' } });

      await expect(handleChangePersona(formData({
        caseId: 'c1', cycleId: 'cy1', customerPersonaId: 'p1',
      }))).rejects.toThrow(/Could not verify the decision status/);

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleCompleteTask cycle score recompute', () => {
    it('recomputes the cycle score after a re-answer clears the grade', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
      mockEq.mockReturnValueOnce(stub({ single: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: {
        id: 't1', review_cycle_id: 'cy1', task_type: 'scoring',
        param: { default_owning_role: 'rm', input_type: 'numeric' },
      } });
      mockEq.mockReturnValueOnce(stub({ maybeSingle: mockSingle }));
      mockSingle.mockResolvedValueOnce({ data: { credit_cases: { status: 'In Review' } }, error: null });
      mockUpdate.mockReturnValue(stub({ eq: mockEq }));
      mockEq.mockResolvedValue({ error: null });

      // Empty numeric answer: no grade, so the saved row drops out of scoring.
      await handleCompleteTask(formData({ caseId: 'c1', taskId: 't1', rawInput: '', gradeValue: '' }));

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ grade_value: null }));
      expect(scoring.updateCycleScore).toHaveBeenCalledWith('cy1');
      // The recompute must read the new row, so it runs after the write.
      expect(vi.mocked(scoring.updateCycleScore).mock.invocationCallOrder[0])
        .toBeGreaterThan(mockUpdate.mock.invocationCallOrder[0]);
    });
  });

  describe('handleCreateApprovalRound', () => {
    it('creates approval round', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['kam'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);

      mockUpdate.mockReturnValue(stub({ eq: mockEq }));
      mockSingle.mockResolvedValueOnce({ data: { id: 'r1' }, error: null });

      await handleCreateApprovalRound(formData({
        caseId: 'c1', cycleId: 'cy1', stage: '2', roundType: 'ordinary'
      }));

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'Awaiting Approval' });
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        review_cycle_id: 'cy1', stage: 2, round_type: 'ordinary'
      }));
    });

    it('opens the board round eagerly when an appeal is started', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      mockSingle
        .mockResolvedValueOnce({ data: { member_ids: ['m1', 'm2'] }, error: null }) // active roster
        .mockResolvedValueOnce({ data: { id: 'r1' }, error: null });              // approval round

      await handleCreateApprovalRound(formData({
        caseId: 'c1', cycleId: 'cy1', stage: '3', roundType: 'appeal'
      }));

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ review_cycle_id: 'cy1', round_type: 'appeal' }));
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        approval_round_id: 'r1',
        roster_snapshot: ['m1', 'm2'],
        status: 'open',
        vote_window_end: expect.any(String),
      }));
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'Appealed' });
    });

    it('convenes the ambiguity board with round_type ambiguity_board', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['kam'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      mockSingle
        .mockResolvedValueOnce({ data: { member_ids: ['m1'] }, error: null })
        .mockResolvedValueOnce({ data: { id: 'r2' }, error: null });

      await handleCreateApprovalRound(formData({
        caseId: 'c1', cycleId: 'cy1', stage: '2', roundType: 'ambiguity_board'
      }));

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ round_type: 'ambiguity_board' }));
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ approval_round_id: 'r2', roster_snapshot: ['m1'] }));
    });

    it('rejects a new round while another round is open', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      mockRows.mockResolvedValueOnce(stub({ data: [{ id: 'open-round' }, { id: 'open-round-2' }], error: null }));

      await expect(handleCreateApprovalRound(formData({
        caseId: 'c1', cycleId: 'cy1', stage: '3', roundType: 'appeal'
      }))).rejects.toThrow(/already has an open decision round/);

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('fails closed when the open-round query errors', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      mockRows.mockResolvedValueOnce(stub({ data: null, error: { message: 'db down' } }));

      await expect(handleCreateApprovalRound(formData({
        caseId: 'c1', cycleId: 'cy1', stage: '3', roundType: 'appeal'
      }))).rejects.toThrow(/Could not verify open decision rounds/);

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('fails when the committee roster read errors', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'roster down' } });

      await expect(handleCreateApprovalRound(formData({
        caseId: 'c1', cycleId: 'cy1', stage: '3', roundType: 'appeal'
      }))).rejects.toThrow(/Could not read the committee roster/);

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('reports both failures when the board insert and the rollback delete fail', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['rm'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      mockSingle
        .mockResolvedValueOnce({ data: { member_ids: ['m1'] }, error: null })
        .mockResolvedValueOnce({ data: { id: 'r3' }, error: null });
      // Second insert (board_rounds) fails; the rollback delete also fails.
      mockInsertResult.mockReturnValueOnce(stub({ error: { message: 'board insert failed' } }));
      mockDelete.mockReturnValueOnce(stub({ error: { message: 'delete blocked' } }));

      await expect(handleCreateApprovalRound(formData({
        caseId: 'c1', cycleId: 'cy1', stage: '3', roundType: 'appeal'
      }))).rejects.toThrow(/could not be rolled back/);
    });
  });

  describe('handleApprovalDecision round rules', () => {
    it('rejects an ordinary decision on a board-decided round', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['ordinary_approver'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      vi.spyOn(auth, 'isAdmin').mockReturnValue(false);
      mockSingle.mockResolvedValueOnce({ data: { review_cycle_id: 'cy1', status: 'open', round_type: 'appeal' }, error: null });

      await expect(handleApprovalDecision(formData({
        caseId: 'c1', roundId: 'r1', decision: 'approve', comment: 'ok',
      }))).rejects.toThrow(/board ballot/);

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('rejects a second decision by the same approver on the same round', async () => {
      vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(stub({ id: 'u1', roles: ['ordinary_approver'] }));
      vi.spyOn(auth, 'hasAnyRole').mockReturnValue(true);
      vi.spyOn(auth, 'isAdmin').mockReturnValue(false);
      mockSingle.mockResolvedValueOnce({ data: { review_cycle_id: 'cy1', status: 'open', round_type: 'ordinary' }, error: null });
      mockRows.mockResolvedValueOnce(stub({ data: [{ id: 'd1' }], error: null }));

      await expect(handleApprovalDecision(formData({
        caseId: 'c1', roundId: 'r1', decision: 'approve', comment: 'ok',
      }))).rejects.toThrow(/already recorded a decision/);

      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
