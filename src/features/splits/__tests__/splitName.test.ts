import { describe, expect, it } from 'vitest';
import {
  MAX_SPLIT_NAME_LENGTH,
  validateSplitName,
} from '../lib/splitName';

describe('validateSplitName', () => {
  it('accepts a normal name', () => {
    expect(validateSplitName('Push')).toEqual({ ok: true, name: 'Push' });
  });

  it('trims and collapses whitespace', () => {
    expect(validateSplitName('  Upper   Body  ')).toEqual({ ok: true, name: 'Upper Body' });
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(validateSplitName('').ok).toBe(false);
    expect(validateSplitName('   ').ok).toBe(false);
  });

  it('rejects a single character — the typo case that created junk splits', () => {
    const result = validateSplitName('Y');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least 2/);
  });

  it('rejects a name with no letters', () => {
    expect(validateSplitName('123').ok).toBe(false);
    expect(validateSplitName('--').ok).toBe(false);
  });

  it('rejects an over-long name', () => {
    expect(validateSplitName('x'.repeat(MAX_SPLIT_NAME_LENGTH + 1)).ok).toBe(false);
  });

  it('accepts a name exactly at the limit', () => {
    const name = 'a'.repeat(MAX_SPLIT_NAME_LENGTH);
    expect(validateSplitName(name)).toEqual({ ok: true, name });
  });

  it('rejects a duplicate regardless of case or padding', () => {
    const result = validateSplitName('push', ['Push', 'Legs']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already have a split/);

    expect(validateSplitName('Legs', ['  legs  ']).ok).toBe(false);
  });

  it('allows a name that only resembles an existing one', () => {
    expect(validateSplitName('Push B', ['Push']).ok).toBe(true);
  });
});
