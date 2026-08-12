import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../../workout/types';
import {
  buildFirstSetSeries,
  getFirstSetTrend,
  getRangeAvailability,
  isPersonalBest,
  pickDefaultRange,
  rangeStartMs,
} from '../firstSetProgress';

function makeSession(
  id: string,
  completedAt: number,
  exercises: WorkoutSession['exercises'],
): WorkoutSession {
  return {
    id,
    splitId: 'split-1',
    splitName: 'Push',
    startedAt: completedAt - 3_600_000,
    completedAt,
    exercises,
  };
}

describe('rangeStartMs', () => {
  it('returns null for all', () => {
    expect(rangeStartMs('all', 1_000_000)).toBeNull();
  });

  it('returns ~60 days before now for 2m', () => {
    const now = 100_000_000;
    expect(rangeStartMs('2m', now)).toBe(now - 60 * 24 * 60 * 60 * 1000);
  });
});

describe('buildFirstSetSeries', () => {
  const now = Date.UTC(2026, 6, 21);

  it('uses the first logged set and respects planned exercise id for substitutes', () => {
    const sessions = [
      makeSession('s1', now - 10 * 24 * 60 * 60 * 1000, [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench',
          sets: [
            { reps: 5, weightKg: 80, loggedAt: 1 },
            { reps: 5, weightKg: 85, loggedAt: 2 },
          ],
        },
      ]),
      makeSession('s2', now - 3 * 24 * 60 * 60 * 1000, [
        {
          exerciseId: 'sub-1',
          exerciseName: 'DB Press',
          substitutedForExerciseId: 'bench',
          substitutedForExerciseName: 'Bench',
          sets: [{ reps: 6, weightKg: 80, loggedAt: 3 }],
        },
      ]),
    ];

    const points = buildFirstSetSeries(sessions, 'bench', '2m', now);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ weightKg: 80, reps: 5 });
    expect(points[1]).toMatchObject({ weightKg: 80, reps: 6, exerciseName: 'DB Press' });
  });

  it('filters out sessions outside the selected range', () => {
    const sessions = [
      makeSession('old', now - 100 * 24 * 60 * 60 * 1000, [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench',
          sets: [{ reps: 5, weightKg: 70, loggedAt: 1 }],
        },
      ]),
      makeSession('recent', now - 5 * 24 * 60 * 60 * 1000, [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench',
          sets: [{ reps: 5, weightKg: 80, loggedAt: 2 }],
        },
      ]),
    ];

    expect(buildFirstSetSeries(sessions, 'bench', '2m', now)).toHaveLength(1);
    expect(buildFirstSetSeries(sessions, 'bench', 'all', now)).toHaveLength(2);
  });
});

describe('getFirstSetTrend', () => {
  it('detects reps-only progress at the same weight', () => {
    const trend = getFirstSetTrend([
      {
        date: 1,
        label: 'Jul 1',
        sessionId: 'a',
        weightKg: 80,
        reps: 5,
        exerciseName: 'Bench',
      },
      {
        date: 2,
        label: 'Jul 8',
        sessionId: 'b',
        weightKg: 80,
        reps: 7,
        exerciseName: 'Bench',
      },
    ]);
    expect(trend?.kind).toBe('reps_up');
    expect(trend?.deltaReps).toBe(2);
  });

  it('prefers weight change over reps when both move', () => {
    const trend = getFirstSetTrend([
      {
        date: 1,
        label: 'Jul 1',
        sessionId: 'a',
        weightKg: 80,
        reps: 8,
        exerciseName: 'Bench',
      },
      {
        date: 2,
        label: 'Jul 8',
        sessionId: 'b',
        weightKg: 85,
        reps: 5,
        exerciseName: 'Bench',
      },
    ]);
    expect(trend?.kind).toBe('weight_up');
  });
});

describe('isPersonalBest', () => {
  it('returns true when latest matches best weight with equal-or-better reps', () => {
    const points = [
      {
        date: 1,
        label: 'a',
        sessionId: '1',
        weightKg: 80,
        reps: 5,
        exerciseName: 'Bench',
      },
      {
        date: 2,
        label: 'b',
        sessionId: '2',
        weightKg: 85,
        reps: 5,
        exerciseName: 'Bench',
      },
    ];
    expect(isPersonalBest(points)).toBe(true);
  });

  it('returns false for a single point', () => {
    expect(
      isPersonalBest([
        {
          date: 1,
          label: 'a',
          sessionId: '1',
          weightKg: 80,
          reps: 5,
          exerciseName: 'Bench',
        },
      ]),
    ).toBe(false);
  });
});

describe('getRangeAvailability / pickDefaultRange', () => {
  const now = Date.UTC(2026, 6, 21);
  const DAY = 24 * 60 * 60 * 1000;

  function sessionsAtDaysAgo(daysAgo: number[]): WorkoutSession[] {
    return daysAgo.map((d, i) =>
      makeSession(`s${i}`, now - d * DAY, [
        { exerciseId: 'ex-1', exerciseName: 'Bench', sets: [{ weightKg: 100, reps: 5, loggedAt: 0 }] },
      ]),
    );
  }

  it('counts the sessions each range would show', () => {
    // one this month, one ~45 days back, one ~100 days back
    const availability = getRangeAvailability(sessionsAtDaysAgo([5, 45, 100]), 'ex-1', now);
    const byId = Object.fromEntries(availability.map((r) => [r.id, r.count]));
    expect(byId['1m']).toBe(1);
    expect(byId['2m']).toBe(2);
    expect(byId['6m']).toBe(3);
    expect(byId['all']).toBe(3);
  });

  it('marks empty ranges so they can be subdued', () => {
    const availability = getRangeAvailability(sessionsAtDaysAgo([100]), 'ex-1', now);
    expect(availability.find((r) => r.id === '1m')?.hasData).toBe(false);
    expect(availability.find((r) => r.id === 'all')?.hasData).toBe(true);
  });

  it('defaults to the smallest range that shows a real trend', () => {
    // 1m has 1 point, 2m has 3 -> open on 2m
    const availability = getRangeAvailability(sessionsAtDaysAgo([5, 40, 50]), 'ex-1', now);
    expect(pickDefaultRange(availability)).toBe('2m');
  });

  it('falls back to the widest range with data when none has enough for a trend', () => {
    // A single point 100 days back: no range reaches 3, so open the widest one
    // that shows it rather than a window that looks empty.
    const availability = getRangeAvailability(sessionsAtDaysAgo([100]), 'ex-1', now);
    expect(pickDefaultRange(availability)).toBe('all');
  });

  it('falls back to all when there is nothing at all', () => {
    const availability = getRangeAvailability([], 'ex-1', now);
    expect(pickDefaultRange(availability)).toBe('all');
  });
});
