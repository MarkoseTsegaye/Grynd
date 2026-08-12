import { describe, expect, it } from 'vitest';
import {
  buildSparklinePoints,
  formatTrendPercent,
  getSeriesTrend,
  toPolylinePoints,
} from '../sparkline';

describe('buildSparklinePoints', () => {
  it('spans the full width and puts the highest value nearest the top', () => {
    const points = buildSparklinePoints([1, 2, 3], 60, 20);
    expect(points).toHaveLength(3);
    expect(points[0].x).toBe(0);
    expect(points[2].x).toBe(60);
    expect(points[2].y).toBeLessThan(points[0].y);
  });

  it('centres a flat series instead of pinning it to the floor', () => {
    const points = buildSparklinePoints([5, 5, 5], 60, 20);
    const ys = points.map((p) => p.y);
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBeCloseTo(10, 5);
  });

  it('centres a single point', () => {
    const points = buildSparklinePoints([7], 60, 20);
    expect(points).toEqual([{ x: 30, y: 10 }]);
  });

  it('keeps the stroke inside the box', () => {
    const points = buildSparklinePoints([1, 10], 60, 20, 2);
    for (const p of points) {
      expect(p.y).toBeGreaterThanOrEqual(2);
      expect(p.y).toBeLessThanOrEqual(18);
    }
  });

  it('returns nothing for empty input or a zero-size box', () => {
    expect(buildSparklinePoints([], 60, 20)).toEqual([]);
    expect(buildSparklinePoints([1, 2], 0, 20)).toEqual([]);
  });
});

describe('toPolylinePoints', () => {
  it('formats as an svg points string at two decimals', () => {
    expect(toPolylinePoints([{ x: 0, y: 10 }, { x: 5.5, y: 0 }])).toBe('0.00,10.00 5.50,0.00');
  });
});

describe('getSeriesTrend', () => {
  it('measures across the whole series, not just the last step', () => {
    // dips at the end but is well up overall
    expect(getSeriesTrend([100, 130, 120])).toEqual({ direction: 'up', percent: 20 });
  });

  it('reports a decline', () => {
    expect(getSeriesTrend([100, 90])).toEqual({ direction: 'down', percent: -10 });
  });

  it('reports flat when the endpoints match', () => {
    expect(getSeriesTrend([100, 120, 100])).toEqual({ direction: 'flat', percent: 0 });
  });

  it('needs at least two points', () => {
    expect(getSeriesTrend([100])).toBeNull();
    expect(getSeriesTrend([])).toBeNull();
  });

  it('refuses to divide by a non-positive baseline', () => {
    expect(getSeriesTrend([0, 50])).toBeNull();
    expect(getSeriesTrend([NaN, 50])).toBeNull();
  });
});

describe('formatTrendPercent', () => {
  it('signs the value', () => {
    expect(formatTrendPercent({ direction: 'up', percent: 4 })).toBe('+4%');
    expect(formatTrendPercent({ direction: 'down', percent: -7 })).toBe('-7%');
    expect(formatTrendPercent({ direction: 'flat', percent: 0 })).toBe('0%');
  });
});
