import { describe, expect, it } from 'vitest';
import { toDateKey } from '../../../../shared/lib/date';
import type { WeightEntry } from '../../types';
import {
  buildWeightSeries,
  filterPointsByRange,
  getEntryForDateKey,
  getLatestWeightLbs,
  getWeeklyDelta,
  rangeStartMs,
  rollingAverageLbs,
  sortByDate,
} from '../weightStats';

function localDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function makeEntry(
  input: {
    year: number;
    month: number;
    day: number;
    weightLbs: number;
    calories?: number;
    id?: string;
  },
): WeightEntry {
  const date = localDate(input.year, input.month, input.day);
  return {
    id: input.id ?? `id-${input.year}-${input.month}-${input.day}`,
    dateKey: toDateKey(date),
    loggedAt: date.getTime(),
    weightLbs: input.weightLbs,
    ...(input.calories !== undefined ? { calories: input.calories } : {}),
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('sortByDate', () => {
  it('sorts by dateKey ascending, not by loggedAt', () => {
    const later = { ...makeEntry({ year: 2026, month: 8, day: 1, weightLbs: 180 }), loggedAt: Date.now() };
    const earlier = { ...makeEntry({ year: 2026, month: 7, day: 15, weightLbs: 182 }), loggedAt: Date.now() + 10_000 };
    expect(sortByDate([later, earlier]).map((e) => e.dateKey)).toEqual([
      '2026-07-15',
      '2026-08-01',
    ]);
  });
});

describe('getEntryForDateKey', () => {
  it('returns the entry with a matching dateKey or null', () => {
    const entries = [
      makeEntry({ year: 2026, month: 8, day: 1, weightLbs: 180 }),
      makeEntry({ year: 2026, month: 8, day: 2, weightLbs: 181 }),
    ];
    expect(getEntryForDateKey(entries, '2026-08-02')?.weightLbs).toBe(181);
    expect(getEntryForDateKey(entries, '2026-08-03')).toBeNull();
  });
});

describe('buildWeightSeries', () => {
  it('returns points sorted by date with a label and no undefined calories key', () => {
    const entries = [
      makeEntry({ year: 2026, month: 8, day: 2, weightLbs: 181, calories: 3000 }),
      makeEntry({ year: 2026, month: 8, day: 1, weightLbs: 180 }),
    ];
    const series = buildWeightSeries(entries);
    expect(series.map((p) => p.dateKey)).toEqual(['2026-08-01', '2026-08-02']);
    expect(series[0].label).toBe('Aug 1');
    expect('calories' in series[0]).toBe(false);
    expect(series[1].calories).toBe(3000);
  });
});

describe('rangeStartMs / filterPointsByRange', () => {
  const now = localDate(2026, 8, 30, 12).getTime();

  it('returns null for the "all" range', () => {
    expect(rangeStartMs('all', now)).toBeNull();
  });

  it('returns 7 days ago for "1w"', () => {
    expect(rangeStartMs('1w', now)).toBe(now - 7 * MS_PER_DAY);
  });

  it('filters points to those in the range', () => {
    const entries = [
      makeEntry({ year: 2026, month: 8, day: 1, weightLbs: 180 }),
      makeEntry({ year: 2026, month: 8, day: 25, weightLbs: 181 }),
      makeEntry({ year: 2026, month: 8, day: 30, weightLbs: 179 }),
    ];
    const points = buildWeightSeries(entries);
    expect(filterPointsByRange(points, '1w', now).map((p) => p.dateKey)).toEqual([
      '2026-08-25',
      '2026-08-30',
    ]);
    expect(filterPointsByRange(points, 'all', now).length).toBe(3);
  });
});

describe('rollingAverageLbs', () => {
  const endMs = localDate(2026, 8, 30, 12).getTime();

  it('returns null when no entries fall in the window', () => {
    expect(rollingAverageLbs([], endMs, 7)).toBeNull();
    expect(
      rollingAverageLbs(
        [makeEntry({ year: 2026, month: 6, day: 1, weightLbs: 180 })],
        endMs,
        7,
      ),
    ).toBeNull();
  });

  it('averages entries within the trailing window', () => {
    const entries = [
      makeEntry({ year: 2026, month: 8, day: 24, weightLbs: 180 }),
      makeEntry({ year: 2026, month: 8, day: 27, weightLbs: 182 }),
      makeEntry({ year: 2026, month: 8, day: 30, weightLbs: 184 }),
    ];
    // All 3 within the last 7 days: (180+182+184)/3 = 182.
    expect(rollingAverageLbs(entries, endMs, 7)).toBe(182);
  });

  it('excludes entries at or before the window start (exclusive lower bound)', () => {
    const start = endMs - 7 * MS_PER_DAY;
    const entries = [
      makeEntry({ year: 2026, month: 8, day: 23, weightLbs: 999 }), // > 7 days back, excluded
      makeEntry({ year: 2026, month: 8, day: 30, weightLbs: 180 }),
    ];
    void start;
    expect(rollingAverageLbs(entries, endMs, 7)).toBe(180);
  });
});

describe('getWeeklyDelta', () => {
  const referenceMs = localDate(2026, 8, 30, 12).getTime();

  it('returns null when either window has no entries', () => {
    // Only current week has entries.
    expect(
      getWeeklyDelta([makeEntry({ year: 2026, month: 8, day: 29, weightLbs: 180 })], referenceMs),
    ).toBeNull();
  });

  it('reports "up" when current avg exceeds previous by more than the steady threshold', () => {
    const entries = [
      makeEntry({ year: 2026, month: 8, day: 18, weightLbs: 178 }),
      makeEntry({ year: 2026, month: 8, day: 25, weightLbs: 180 }),
    ];
    const delta = getWeeklyDelta(entries, referenceMs);
    expect(delta).not.toBeNull();
    expect(delta?.direction).toBe('up');
    expect(delta?.deltaLbs).toBeCloseTo(2, 5);
  });

  it('reports "down" when current avg is lower', () => {
    const entries = [
      makeEntry({ year: 2026, month: 8, day: 18, weightLbs: 182 }),
      makeEntry({ year: 2026, month: 8, day: 25, weightLbs: 180 }),
    ];
    expect(getWeeklyDelta(entries, referenceMs)?.direction).toBe('down');
  });

  it('reports "steady" when the delta is within the threshold', () => {
    const entries = [
      makeEntry({ year: 2026, month: 8, day: 18, weightLbs: 180.0 }),
      makeEntry({ year: 2026, month: 8, day: 25, weightLbs: 180.1 }),
    ];
    expect(getWeeklyDelta(entries, referenceMs)?.direction).toBe('steady');
  });
});

describe('getLatestWeightLbs', () => {
  it('returns null when there are no entries', () => {
    expect(getLatestWeightLbs([])).toBeNull();
  });

  it('returns the weight of the latest-dated entry', () => {
    const entries = [
      makeEntry({ year: 2026, month: 8, day: 1, weightLbs: 180 }),
      makeEntry({ year: 2026, month: 8, day: 3, weightLbs: 182 }),
      makeEntry({ year: 2026, month: 8, day: 2, weightLbs: 181 }),
    ];
    expect(getLatestWeightLbs(entries)).toBe(182);
  });
});
