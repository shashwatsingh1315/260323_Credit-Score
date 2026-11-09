import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory Supabase double: each table resolves to the fixture set on state.tables,
// and inserts are recorded so tests can assert on what was created.
const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Result = { data: unknown; error: unknown };
  interface Builder {
    select: () => Builder;
    eq: () => Builder;
    in: () => Builder;
    order: () => Builder;
    limit: () => Builder;
    insert: (row: Row) => Builder;
    single: () => Promise<Result>;
    maybeSingle: () => Promise<Result>;
    then: (onFul: (value: Result) => unknown, onRej: (reason: unknown) => unknown) => Promise<unknown>;
  }
  const state = {
    tables: {} as Record<string, Result>,
    inserts: [] as Array<{ table: string; row: Row }>,
  };
  const resolve = (table: string): Result => state.tables[table] ?? { data: null, error: null };
  function makeBuilder(table: string): Builder {
    let inserted: Result | null = null;
    const b: Builder = {
      select: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      limit: () => b,
      insert: (row: Row) => {
        state.inserts.push({ table, row });
        inserted = { data: { id: `new-${table}`, ...row }, error: null };
        return b;
      },
      single: async () => inserted ?? resolve(table),
      maybeSingle: async () => inserted ?? resolve(table),
      then: (onFul, onRej) => Promise.resolve(resolve(table)).then(onFul, onRej),
    };
    return b;
  }
  return { state, makeBuilder };
});

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: (table: string) => h.makeBuilder(table) })),
}));

vi.mock('@/utils/auth', () => ({
  getCurrentUser: vi.fn(),
  logAuditEvent: vi.fn(),
  hasAnyRole: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock('@/utils/boardGuards', () => ({
  assertCanCastBoardVote: vi.fn(),
  BOARD_VOTE_DECISIONS: ['approve', 'reject', 'abstain'],
}));

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { fetchBoardDetails } from './actions';

const baseFixtures = () => {
  h.state.tables = {
    credit_cases: { data: { id: 'c1', case_number: 'CASE-1' }, error: null },
    review_cycles: { data: { id: 'cy1', active_stage: 3 }, error: null },
    approval_rounds: { data: { id: 'ar1', review_cycle_id: 'cy1', round_type: 'appeal', stage: 3 }, error: null },
    board_rounds: { data: null, error: null },
    committee_rosters: { data: { member_ids: ['m1', 'm2', 'm3'] }, error: null },
    board_votes: { data: [], error: null },
    profiles: { data: [], error: null },
  };
  h.state.inserts = [];
};

describe('cases/[id]/board/actions.ts fetchBoardDetails', () => {
  beforeEach(() => {
    baseFixtures();
  });

  it('returns the existing board round without creating another one', async () => {
    h.state.tables.board_rounds = {
      data: { id: 'br1', approval_round_id: 'ar1', roster_snapshot: ['m1'], status: 'open' },
      error: null,
    };

    const result = await fetchBoardDetails('c1');

    expect(result.boardRound?.id).toBe('br1');
    expect(h.state.inserts.filter((i) => i.table === 'board_rounds')).toHaveLength(0);
  });

  it('falls back to creating the board round once from the active roster when none exists', async () => {
    const result = await fetchBoardDetails('c1');

    const boardInserts = h.state.inserts.filter((i) => i.table === 'board_rounds');
    expect(boardInserts).toHaveLength(1);
    expect(boardInserts[0].row).toEqual(expect.objectContaining({
      approval_round_id: 'ar1',
      roster_snapshot: ['m1', 'm2', 'm3'],
      status: 'open',
    }));
    expect(result.boardRound).toBeTruthy();
  });

  it('does not create a board round when no committee roster is active', async () => {
    h.state.tables.committee_rosters = { data: null, error: null };

    const result = await fetchBoardDetails('c1');

    expect(h.state.inserts.filter((i) => i.table === 'board_rounds')).toHaveLength(0);
    expect(result.boardRound).toBeNull();
  });
});
