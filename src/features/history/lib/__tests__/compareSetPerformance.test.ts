import { describe, expect, it } from 'vitest';
import {
  buildSetComparisonAccessibilityLabel,
  compareSets,
  formatSetDeltaLabel,
} from '../compareSetPerformance';
import type { LoggedSet } from '../../../workout/types';

function set(weightKg: number, reps: number): LoggedSet {
  return { weightKg, reps, loggedAt: 0 };
}

describe('compareSets', () => {
  it('returns null when nothing changed', () => {
    expect(compareSets(set(100, 5), set(100, 5))).toBeNull();
  });

  it('flags a weight-only gain as a single-metric progress', () => {
    expect(compareSets(set(100, 5), set(105, 5))).toEqual({ direction: 'progress', arrowCount: 1 });
  });

  it('flags a reps-only gain as a single-metric progress', () => {
    expect(compareSets(set(100, 5), set(100, 6))).toEqual({ direction: 'progress', arrowCount: 1 });
  });

  it('flags both metrics up as the strongest progress', () => {
    expect(compareSets(set(100, 5), set(105, 6))).toEqual({ direction: 'progress', arrowCount: 3 });
  });

  it('flags both metrics down as the strongest decline', () => {
    expect(compareSets(set(100, 5), set(95, 4))).toEqual({ direction: 'decline', arrowCount: 3 });
  });

  it('weights the verdict by load when the two metrics disagree', () => {
    expect(compareSets(set(100, 5), set(105, 4))).toEqual({ direction: 'progress', arrowCount: 2 });
    expect(compareSets(set(100, 5), set(95, 6))).toEqual({ direction: 'decline', arrowCount: 2 });
  });
});

describe('formatSetDeltaLabel', () => {
  it('renders the arrow count as the chip magnitude', () => {
    expect(formatSetDeltaLabel({ direction: 'progress', arrowCount: 3 })).toBe('3');
    expect(formatSetDeltaLabel({ direction: 'decline', arrowCount: 1 })).toBe('1');
  });
});

describe('buildSetComparisonAccessibilityLabel', () => {
  it('spells out both metrics for screen readers', () => {
    const prev = set(100, 5);
    const current = set(105, 6);
    const result = compareSets(prev, current)!;
    expect(buildSetComparisonAccessibilityLabel(2, prev, current, result)).toBe(
      'Set 2 progress: weight up, reps up',
    );
  });

  it('names the unchanged metric', () => {
    const prev = set(100, 5);
    const current = set(100, 4);
    const result = compareSets(prev, current)!;
    expect(buildSetComparisonAccessibilityLabel(1, prev, current, result)).toBe(
      'Set 1 decline: weight same, reps down',
    );
  });
});
