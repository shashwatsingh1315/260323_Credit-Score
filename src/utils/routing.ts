export type RoutingContextRule = {
  exposure_min?: number;
  scenario?: string;
  score_below?: number;
};

export type RoutingRule = {
  context_rule?: RoutingContextRule | null;
  target_stage: number;
};

export type RoutingContext = {
  exposure: number;
  scenario: string;
  score?: number;
};

export function routingRuleMatches(rule: RoutingRule, context: RoutingContext): boolean {
  const condition = rule.context_rule ?? {};

  if (condition.exposure_min != null && context.exposure < condition.exposure_min) return false;
  if (condition.scenario && context.scenario !== condition.scenario) return false;

  // A score rule cannot match at intake. It is deliberately re-evaluated once
  // a stage score exists, so required depth only ever grows during a cycle.
  if (condition.score_below != null) {
    if (context.score == null || context.score >= condition.score_below) return false;
  }

  return true;
}

export function evaluateRequiredStage(rules: RoutingRule[], context: RoutingContext): 1 | 2 | 3 {
  let required: 1 | 2 | 3 = 1;

  for (const rule of rules) {
    if (!routingRuleMatches(rule, context)) continue;
    const target = Math.max(1, Math.min(3, Math.trunc(rule.target_stage))) as 1 | 2 | 3;
    required = Math.max(required, target) as 1 | 2 | 3;
  }

  return required;
}

export function describeRoutingOutcome(
  rules: RoutingRule[],
  context: RoutingContext,
  requiredStage = evaluateRequiredStage(rules, context),
): string {
  const reasons = rules
    .filter((rule) => rule.target_stage === requiredStage && routingRuleMatches(rule, context))
    .map((rule) => {
      const condition = rule.context_rule ?? {};
      const parts: string[] = [];
      if (condition.exposure_min != null) parts.push(`exposure ≥ ₹${condition.exposure_min.toLocaleString('en-IN')}`);
      if (condition.scenario) parts.push(`scenario is ${condition.scenario.replaceAll('_', ' ')}`);
      if (condition.score_below != null) parts.push(`score < ${condition.score_below}`);
      return parts.join(' and ');
    })
    .filter(Boolean);

  return reasons.length > 0
    ? `Routed to Stage ${requiredStage}: ${reasons.join('; ')}.`
    : `Routed to Stage ${requiredStage}: default review depth.`;
}
