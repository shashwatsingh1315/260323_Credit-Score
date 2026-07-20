import { describe, expect, it } from 'vitest';
import { calculateValidityExpiry, selectValidityRule } from './validity';

describe('selectValidityRule', () => {
  const context = { score_band: 'A', scenario: 'customer_name_customer_pays' };

  it('chooses the most specific matching rule', () => {
    const rule = selectValidityRule([
      { context_rule: {}, validity_days: 90 },
      { context_rule: { score_band: 'A' }, validity_days: 60 },
      { context_rule: context, validity_days: 45 },
    ], context);
    expect(rule?.validity_days).toBe(45);
  });

  it('uses the shortest window to break a specificity tie', () => {
    const rule = selectValidityRule([
      { context_rule: { score_band: 'A' }, validity_days: 60 },
      { context_rule: { score_band: 'A' }, validity_days: 30 },
    ], context);
    expect(rule?.validity_days).toBe(30);
  });

  it('returns null when no rule matches', () => {
    expect(selectValidityRule([
      { context_rule: { score_band: 'B' }, validity_days: 30 },
    ], context)).toBeNull();
  });
});

it('calculates expiry from the approval timestamp', () => {
  expect(calculateValidityExpiry(new Date('2026-07-19T00:00:00.000Z'), 30).toISOString())
    .toBe('2026-08-18T00:00:00.000Z');
});
