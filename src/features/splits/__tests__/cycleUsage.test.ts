import { describe, expect, it } from 'vitest';
import { formatCycleDays, getCycleUsage } from '../lib/cycleUsage';
import type { CycleDay } from '../types';

const cycle: CycleDay[] = [
  { id: 'a', type: 'split', splitId: 'push' },
  { id: 'b', type: 'split', splitId: 'pull' },
  { id: 'c', type: 'rest' },
  { id: 'd', type: 'split', splitId: 'push' },
  { id: 'e', type: 'split', splitId: 'legs' },
];

describe('getCycleUsage', () => {
  it('finds every day running the split, 1-based', () => {
    expect(getCycleUsage(cycle, 'push').days).toEqual([1, 4]);
  });

  it('labels a single day in the singular', () => {
    expect(getCycleUsage(cycle, 'legs').label).toBe('day 5');
  });

  it('labels multiple days', () => {
    expect(getCycleUsage(cycle, 'push').label).toBe('days 1, 4');
  });

  it('reports a split missing from the cycle', () => {
    const usage = getCycleUsage(cycle, 'arms');
    expect(usage.inCycle).toBe(false);
    expect(usage.days).toEqual([]);
    expect(usage.label).toBeNull();
  });

  it('ignores rest days', () => {
    expect(getCycleUsage(cycle, 'rest')).toEqual({ days: [], inCycle: false, label: null });
  });

  it('handles an empty cycle', () => {
    expect(getCycleUsage([], 'push').inCycle).toBe(false);
  });
});

describe('formatCycleDays', () => {
  it('summarises once listing every day stops being readable', () => {
    expect(formatCycleDays([1, 2, 3, 4])).toBe('4 days');
    expect(formatCycleDays([1, 2, 3])).toBe('days 1, 2, 3');
  });

  it('is null for none', () => {
    expect(formatCycleDays([])).toBeNull();
  });
});
