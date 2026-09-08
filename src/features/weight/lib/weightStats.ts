import { formatShortDate, parseDateKey } from '../../../shared/lib/date';
import type { WeightEntry } from '../types';

export type WeightPoint = {
  id: string;
  dateKey: string;
  date: number;
  label: string;
  weightLbs: number;
};

export type WeightTrendDirection = 'up' | 'down' | 'steady';

export type WeeklyDelta = {
  /** Rolling 7-day mean ending at `referenceMs` (inclusive of that day). */
  current: number;
  /** Rolling 7-day mean of the previous 7-day window. */
  previous: number;
  /** current − previous, in pounds. */
  deltaLbs: number;
  direction: WeightTrendDirection;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Below this magnitude we call it flat rather than up/down — avoids twitchy arrows. */
const STEADY_THRESHOLD_LBS = 0.2;

/**
 * Range chip options mirroring `PROGRESS_RANGE_OPTIONS` in the workout
 * feature. `all` is null (no lower bound).
 */
export const WEIGHT_RANGE_OPTIONS = [
  { id: '1w', label: '1w', days: 7 },
  { id: '1m', label: '1m', days: 30 },
  { id: '3m', label: '3m', days: 90 },
  { id: '6m', label: '6m', days: 180 },
  { id: 'all', label: 'All', days: null },
] as const;

export type WeightRangeId = (typeof WEIGHT_RANGE_OPTIONS)[number]['id'];

export function rangeStartMs(rangeId: WeightRangeId, now: number = Date.now()): number | null {
  const opt = WEIGHT_RANGE_OPTIONS.find((r) => r.id === rangeId);
  if (!opt || opt.days === null) return null;
  return now - opt.days * MS_PER_DAY;
}

function entryDateMs(entry: WeightEntry): number {
  const parsed = parseDateKey(entry.dateKey);
  return parsed ? parsed.getTime() : entry.loggedAt;
}

export function sortByDate(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => entryDateMs(a) - entryDateMs(b));
}

export function getEntryForDateKey(
  entries: WeightEntry[],
  dateKey: string,
): WeightEntry | null {
  return entries.find((e) => e.dateKey === dateKey) ?? null;
}

export function buildWeightSeries(entries: WeightEntry[]): WeightPoint[] {
  return sortByDate(entries).map((entry) => {
    const date = entryDateMs(entry);
    return {
      id: entry.id,
      dateKey: entry.dateKey,
      date,
      label: formatShortDate(date),
      weightLbs: entry.weightLbs,
    };
  });
}

export function filterPointsByRange(
  points: WeightPoint[],
  rangeId: WeightRangeId,
  now: number = Date.now(),
): WeightPoint[] {
  const start = rangeStartMs(rangeId, now);
  if (start === null) return points;
  return points.filter((p) => p.date >= start);
}

/**
 * Mean of `weightLbs` over entries whose local date falls in the window
 * `(endMs − windowDays·day, endMs]`. Returns `null` when the window contains
 * no entries so the caller can render "not enough data yet" instead of a
 * misleading 0.
 */
export function rollingAverageLbs(
  entries: WeightEntry[],
  endMs: number,
  windowDays = 7,
): number | null {
  const start = endMs - windowDays * MS_PER_DAY;
  let sum = 0;
  let count = 0;
  for (const entry of entries) {
    const t = entryDateMs(entry);
    if (t > start && t <= endMs) {
      sum += entry.weightLbs;
      count += 1;
    }
  }
  if (count === 0) return null;
  return sum / count;
}

/**
 * 7-day rolling average vs the 7 days before that. Both windows must have at
 * least one entry — otherwise the delta is meaningless and we return null so
 * the summary card shows a "log more" hint instead of a bogus 0.
 */
export function getWeeklyDelta(
  entries: WeightEntry[],
  referenceMs: number = Date.now(),
): WeeklyDelta | null {
  const current = rollingAverageLbs(entries, referenceMs, 7);
  const previous = rollingAverageLbs(entries, referenceMs - 7 * MS_PER_DAY, 7);
  if (current === null || previous === null) return null;

  const deltaLbs = current - previous;
  const direction: WeightTrendDirection =
    Math.abs(deltaLbs) < STEADY_THRESHOLD_LBS ? 'steady' : deltaLbs > 0 ? 'up' : 'down';

  return { current, previous, deltaLbs, direction };
}

/** Convenience: latest recorded weight (or null if no entries). */
export function getLatestWeightLbs(entries: WeightEntry[]): number | null {
  const sorted = sortByDate(entries);
  if (sorted.length === 0) return null;
  return sorted[sorted.length - 1].weightLbs;
}

export type WeeklyAverage = {
  /** ms at the START (exclusive lower bound of the 7-day window). */
  weekStartMs: number;
  /** ms at the END (inclusive upper bound). Corresponds to `label`. */
  weekEndMs: number;
  /** Formatted `weekEndMs` for display (e.g. "Aug 25"). */
  label: string;
  avgLbs: number;
  entryCount: number;
  /** avgLbs of THIS week minus avgLbs of the previous week; null for the oldest. */
  deltaLbs: number | null;
};

/**
 * Rolling 7-day averages stepping back from `referenceMs`, latest first.
 * Buckets with zero entries are dropped (users don't want a table row saying
 * "0 entries" — the point of the section is to see actual trend, not gaps).
 * `deltaLbs` compares each bucket to the older bucket that came before it in
 * time (so a positive delta means gaining vs the previous week); null for
 * the oldest returned bucket since there's nothing before it to compare.
 */
export function getWeeklyAverages(
  entries: WeightEntry[],
  weekCount = 8,
  referenceMs: number = Date.now(),
): WeeklyAverage[] {
  const raw: Array<Omit<WeeklyAverage, 'deltaLbs'>> = [];

  for (let i = 0; i < weekCount; i++) {
    const weekEndMs = referenceMs - i * 7 * MS_PER_DAY;
    const weekStartMs = weekEndMs - 7 * MS_PER_DAY;

    let sum = 0;
    let entryCount = 0;
    for (const entry of entries) {
      const t = entryDateMs(entry);
      if (t > weekStartMs && t <= weekEndMs) {
        sum += entry.weightLbs;
        entryCount += 1;
      }
    }

    if (entryCount === 0) continue;

    raw.push({
      weekStartMs,
      weekEndMs,
      label: formatShortDate(weekEndMs),
      avgLbs: sum / entryCount,
      entryCount,
    });
  }

  // Compute delta vs the older week (raw is latest-first, so raw[i+1] is older).
  return raw.map((bucket, i) => {
    const older = raw[i + 1];
    return {
      ...bucket,
      deltaLbs: older ? bucket.avgLbs - older.avgLbs : null,
    };
  });
}
