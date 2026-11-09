import { describe, it, expect } from 'vitest';
import { changeSummary, parseIntegerField, parseNumberField, parseParameterForm } from './policy-parsing';

/** Builds the getter parseParameterForm reads from, like FormData.get does (null when absent). */
const formOf = (values: Record<string, string>) => (key: string) => (key in values ? values[key] : null);

const baseForm = {
  parameter_name: 'Bank statement',
  applies_to_subject: 'customer',
  stage: '1',
  default_owning_role: 'rm',
  data_type: 'grade_select',
  weight: '1',
  description: '',
  signal_strength: '3',
  signal_cost: '3',
  signal_lag: 'Leading',
  sla_days: '',
  persistence_scope: 'none',
};

describe('parseNumberField', () => {
  it('keeps 0 as 0 and returns undefined for empty or non-numeric input', () => {
    expect(parseNumberField('0')).toBe(0);
    expect(parseNumberField('0.00')).toBe(0);
    expect(parseNumberField('')).toBeUndefined();
    expect(parseNumberField('   ')).toBeUndefined();
    expect(parseNumberField(null)).toBeUndefined();
    expect(parseNumberField('abc')).toBeUndefined();
  });

  it('rejects non-integers for integer fields', () => {
    expect(parseIntegerField('0')).toBe(0);
    expect(parseIntegerField('2.5')).toBeUndefined();
  });
});

describe('parseParameterForm round trip', () => {
  it('keeps weight 0 and persistence_scope party when saved', () => {
    const result = parseParameterForm(formOf({ ...baseForm, weight: '0', persistence_scope: 'party' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.weight).toBe(0);
    expect(result.fields.persistence_scope).toBe('party');
  });

  it('keeps sla_days 0 and maps an empty SLA to null', () => {
    const zero = parseParameterForm(formOf({ ...baseForm, sla_days: '0' }));
    expect(zero.ok && zero.fields.sla_days).toBe(0);
    const empty = parseParameterForm(formOf({ ...baseForm, sla_days: '' }));
    expect(empty.ok && empty.fields.sla_days).toBeNull();
  });

  it('rejects a non-numeric weight instead of saving 1', () => {
    const result = parseParameterForm(formOf({ ...baseForm, weight: 'heavy' }));
    expect(result).toEqual({ ok: false, error: 'Weight must be a number.' });
  });

  it('rejects an unknown persistence scope instead of wiping it to none', () => {
    const result = parseParameterForm(formOf({ ...baseForm, persistence_scope: 'galaxy' }));
    expect(result.ok).toBe(false);
  });

  it('requires a name and a stage from 1 to 3', () => {
    expect(parseParameterForm(formOf({ ...baseForm, parameter_name: '  ' })).ok).toBe(false);
    expect(parseParameterForm(formOf({ ...baseForm, stage: '4' })).ok).toBe(false);
  });
});

describe('changeSummary', () => {
  it('reports only the fields that changed, before to after', () => {
    const summary = changeSummary({ weight: 1, stage: 1 }, { weight: 0, stage: 1 }, ['weight', 'stage']);
    expect(summary).toBe('weight 1→0');
  });

  it('says so when nothing changed', () => {
    expect(changeSummary({ weight: 1 }, { weight: 1 }, ['weight'])).toBe('no field changes');
  });
});
