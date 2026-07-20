import { describe, expect, it } from 'vitest';
import { evaluateRequiredStage, routingRuleMatches } from './routing';

const context = { exposure: 1_200_000, scenario: 'customer_name_customer_pays' };

describe('evaluateRequiredStage', () => {
  it('defaults to Stage 1', () => {
    expect(evaluateRequiredStage([], context)).toBe(1);
  });

  it('deepens to the highest matching target stage', () => {
    const rules = [
      { context_rule: { exposure_min: 1_000_000 }, target_stage: 2 },
      { context_rule: { scenario: context.scenario }, target_stage: 3 },
      { context_rule: { exposure_min: 9_000_000 }, target_stage: 3 },
    ];
    expect(evaluateRequiredStage(rules, context)).toBe(3);
  });

  it('skips score_below until a score is supplied', () => {
    const rules = [{ context_rule: { score_below: 60 }, target_stage: 3 }];
    expect(evaluateRequiredStage(rules, context)).toBe(1);
    expect(evaluateRequiredStage(rules, { ...context, score: 54 })).toBe(3);
    expect(evaluateRequiredStage(rules, { ...context, score: 70 })).toBe(1);
  });

  it('requires every key in a rule to match', () => {
    expect(routingRuleMatches(
      { context_rule: { exposure_min: 1_000_000, scenario: 'other' }, target_stage: 3 },
      context,
    )).toBe(false);
  });
});
