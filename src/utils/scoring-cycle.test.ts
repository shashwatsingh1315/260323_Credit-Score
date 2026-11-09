/* eslint-disable @typescript-eslint/no-explicit-any -- loose fake Supabase builder, matching scoring.test.ts */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateCycleScore } from './scoring';

// Table-driven fake: every chain resolves to the rows for its table. Updates are recorded.
const tables: Record<string, any> = {};
const updates: { table: string; payload: Record<string, unknown> }[] = [];

function builder(table: string): any {
  const result = () => ({ data: tables[table] ?? [], error: null });
  const b: any = {
    select: () => b,
    eq: () => b,
    not: () => b,
    is: () => b,
    lte: () => b,
    in: () => b,
    order: () => b,
    update: (payload: Record<string, unknown>) => {
      updates.push({ table, payload });
      return b;
    },
    maybeSingle: async () => ({ data: Array.isArray(tables[table]) ? tables[table][0] : tables[table], error: null }),
    single: async () => ({ data: Array.isArray(tables[table]) ? tables[table][0] : tables[table], error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return b;
}

vi.mock('./supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => builder(table),
  })),
}));

function seedCycle(decision: string | null) {
  tables.review_cycles = {
    id: 'cycle1',
    decision,
    active_stage: 1,
    required_stage: 3,
    policy_snapshot_id: 'pol1',
    customer_persona_id: null,
    contractor_persona_id: null,
    dominance_category_id: null,
    approved_credit_days: 90, // founder/board override already applied
    credit_cases: { case_scenario: 'customer_name_customer_pays', requested_exposure_amount: 1000 },
  };
  tables.stage_tasks = [];
  tables.stage_max_totals = { max_total: 100 };
  tables.score_bands = [
    { band_name: 'Low', min_score: 0, max_score: 100, approved_credit_days: 30, is_ambiguity_band: false },
  ];
  tables.routing_thresholds = [];
  tables.personas = [];
}

function cycleUpdatePayload() {
  const u = updates.find((x) => x.table === 'review_cycles');
  expect(u).toBeDefined();
  return u!.payload;
}

describe('updateCycleScore approved-override guard', () => {
  beforeEach(() => {
    updates.length = 0;
    for (const k of Object.keys(tables)) delete tables[k];
  });

  it('leaves approved_credit_days untouched when the cycle is approved', async () => {
    seedCycle('approved');
    await updateCycleScore('cycle1');

    const payload = cycleUpdatePayload();
    expect(payload).not.toHaveProperty('approved_credit_days');
    // Scores and band still refresh while approved.
    expect(payload).toHaveProperty('current_case_score', 0);
    expect(payload).toHaveProperty('score_band_name', 'Low');
    expect(payload).toHaveProperty('is_ambiguous');
  });

  it('still writes approved_credit_days for a cycle that is not approved', async () => {
    seedCycle(null);
    await updateCycleScore('cycle1');

    expect(cycleUpdatePayload()).toHaveProperty('approved_credit_days', 30);
  });
});
