import type { FirstSetPoint } from './firstSetProgress';

export type ChartMetricId = 'weight' | 'e1rm';

export const CHART_METRIC_OPTIONS: { id: ChartMetricId; label: string }[] = [
  { id: 'weight', label: 'Weight' },
  { id: 'e1rm', label: 'Est. 1RM' },
];

/**
 * Epley one-rep-max estimate: weight x (1 + reps/30).
 *
 * The point of charting this is that a session where you held the weight but
 * added reps is real progress, and a raw weight line renders it as a flat line
 * that reads as "no progress". e1RM folds both axes into one number that moves.
 *
 * A single rep is already a 1RM, so it is returned unchanged rather than
 * inflated by the formula.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0;
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function getMetricValue(point: FirstSetPoint, metric: ChartMetricId): number {
  return metric === 'e1rm'
    ? estimateOneRepMax(point.weightKg, point.reps)
    : point.weightKg;
}

/** Rounds a step up to the nearest 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;

  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/**
 * Axis ticks at readable values covering [min, max].
 *
 * The old chart labelled the raw data min/mid/max, which produced axes like
 * "195 / 205 / 215" — technically correct, hard to read. Snapping to a nice
 * step gives round numbers and keeps a flat series from collapsing to a
 * zero-height band.
 */
export function buildAxisTicks(min: number, max: number, desiredCount = 3): number[] {
  const count = Math.max(2, desiredCount);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];

  // A flat series has no range of its own — open a window around the value so
  // the line sits mid-chart instead of pinned to an edge.
  if (max === min) {
    const spread = Math.max(Math.abs(max) * 0.1, 1);
    min -= spread;
    max += spread;
  }

  const step = niceStep((max - min) / (count - 1));
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  // Guard against float drift accumulating past the end value.
  for (let value = start; value <= end + step / 1000; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return ticks;
}

export interface MetricDomain {
  min: number;
  max: number;
  ticks: number[];
}

export function getMetricDomain(values: number[], desiredTicks = 3): MetricDomain {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };

  const ticks = buildAxisTicks(Math.min(...values), Math.max(...values), desiredTicks);
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}
