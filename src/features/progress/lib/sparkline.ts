export interface SparklinePoint {
  x: number;
  y: number;
}

/**
 * Maps a series onto a fixed-size box for a preview sparkline.
 *
 * A flat series is centred rather than pinned to an edge, so "no change" reads
 * as a level line through the middle instead of a line along the floor.
 */
export function buildSparklinePoints(
  values: number[],
  width: number,
  height: number,
  strokeInset = 2,
): SparklinePoint[] {
  if (values.length === 0 || width <= 0 || height <= 0) return [];

  const top = strokeInset;
  const usableHeight = Math.max(height - strokeInset * 2, 1);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (values.length === 1) {
    return [{ x: width / 2, y: top + usableHeight / 2 }];
  }

  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const ratio = range === 0 ? 0.5 : (value - min) / range;
    return { x, y: top + usableHeight - ratio * usableHeight };
  });
}

export function toPolylinePoints(points: SparklinePoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface SeriesTrend {
  direction: TrendDirection;
  /** Whole-number percent change from the first value to the last. */
  percent: number;
}

/**
 * Change across the whole visible series, not just the last two sessions — the
 * row is previewing "is this lift moving?", which a single-session delta
 * answers badly on a noisy series.
 */
export function getSeriesTrend(values: number[]): SeriesTrend | null {
  if (values.length < 2) return null;

  const first = values[0];
  const last = values[values.length - 1];
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) return null;

  const percent = Math.round(((last - first) / first) * 100);
  if (percent === 0) return { direction: 'flat', percent: 0 };
  return { direction: percent > 0 ? 'up' : 'down', percent };
}

export function formatTrendPercent(trend: SeriesTrend): string {
  if (trend.direction === 'flat') return '0%';
  return `${trend.percent > 0 ? '+' : ''}${trend.percent}%`;
}
