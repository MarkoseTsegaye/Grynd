import { describe, expect, it } from 'vitest';
import {
  buildAxisTicks,
  estimateOneRepMax,
  getMetricDomain,
  getMetricValue,
} from '../chartMetric';
import type { FirstSetPoint } from '../firstSetProgress';

function point(weightKg: number, reps: number): FirstSetPoint {
  return { date: 0, label: 'Jan 1', sessionId: 's', weightKg, reps, exerciseName: 'Bench' };
}

describe('estimateOneRepMax', () => {
  it('returns the weight unchanged for a single rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('applies the Epley formula above one rep', () => {
    // 100 x (1 + 5/30) = 116.67
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.666, 2);
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.333, 2);
  });

  it('rises when reps rise at the same weight — the whole point of the metric', () => {
    const held = estimateOneRepMax(100, 6);
    const improved = estimateOneRepMax(100, 8);
    expect(improved).toBeGreaterThan(held);
  });

  it('is zero for non-positive or non-finite input', () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(-10, 5)).toBe(0);
    expect(estimateOneRepMax(NaN, 5)).toBe(0);
  });
});

describe('getMetricValue', () => {
  it('reads raw weight for the weight metric', () => {
    expect(getMetricValue(point(100, 8), 'weight')).toBe(100);
  });

  it('reads the estimate for the e1rm metric', () => {
    expect(getMetricValue(point(100, 8), 'e1rm')).toBeCloseTo(126.666, 2);
  });
});

describe('buildAxisTicks', () => {
  it('snaps to round values covering the data', () => {
    const ticks = buildAxisTicks(195, 215);
    expect(ticks[0]).toBeLessThanOrEqual(195);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(215);
    // every step is the same size and a round number
    const step = ticks[1] - ticks[0];
    expect(step).toBeGreaterThan(0);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(step, 6);
    }
  });

  it('opens a window around a flat series instead of collapsing it', () => {
    const ticks = buildAxisTicks(205, 205);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBeLessThan(205);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(205);
  });

  it('handles a flat series at zero without producing a zero-width axis', () => {
    const ticks = buildAxisTicks(0, 0);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(ticks[0]);
  });

  it('always spans at least two ticks', () => {
    expect(buildAxisTicks(10, 11, 1).length).toBeGreaterThanOrEqual(2);
  });

  it('is defensive about non-finite input', () => {
    expect(buildAxisTicks(NaN, 10)).toEqual([0, 1]);
  });
});

describe('getMetricDomain', () => {
  it('derives min and max from the snapped ticks', () => {
    const domain = getMetricDomain([100, 120, 110]);
    expect(domain.min).toBe(domain.ticks[0]);
    expect(domain.max).toBe(domain.ticks[domain.ticks.length - 1]);
    expect(domain.min).toBeLessThanOrEqual(100);
    expect(domain.max).toBeGreaterThanOrEqual(120);
  });

  it('falls back to a unit domain when there is no data', () => {
    expect(getMetricDomain([])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
  });
});
