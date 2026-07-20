export type ValidityContext = {
  score_band?: string | null;
  scenario?: string | null;
};

export type ValidityRule = {
  context_rule?: ValidityContext | null;
  validity_days: number;
};

export function selectValidityRule<T extends ValidityRule>(rules: T[], context: ValidityContext): T | null {
  const matches = rules.filter((rule) => {
    const condition = rule.context_rule ?? {};
    if (condition.score_band && condition.score_band !== context.score_band) return false;
    if (condition.scenario && condition.scenario !== context.scenario) return false;
    return true;
  });

  matches.sort((a, b) => {
    const specificityA = Object.values(a.context_rule ?? {}).filter(Boolean).length;
    const specificityB = Object.values(b.context_rule ?? {}).filter(Boolean).length;
    return specificityB - specificityA || a.validity_days - b.validity_days;
  });

  return matches[0] ?? null;
}

export function calculateValidityExpiry(approvedAt: Date, validityDays: number): Date {
  return new Date(approvedAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
}
