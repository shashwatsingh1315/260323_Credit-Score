import { describe, expect, it } from 'vitest';
import { formatPolicyOptionLabel, parseRubricGuidance } from './format';

describe('policy text formatting', () => {
  it('renders escaped line breaks as separate guidance lines', () => {
    expect(parseRubricGuidance('Definition: **test**\\nRatings:\\n- [1] Low')).toHaveLength(3);
    expect(parseRubricGuidance('Definition: **test**\\\\nRatings:')).toHaveLength(2);
  });

  it('keeps native policy options concise', () => {
    expect(formatPolicyOptionLabel('Moderate / Medium Risk: long explanation\\nMore detail'))
      .toBe('Moderate / Medium Risk');
  });
});
