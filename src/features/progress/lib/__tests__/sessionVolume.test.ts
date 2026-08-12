import { describe, expect, it } from 'vitest';
import {
  buildVolumeSeries,
  getLatestVolumeTrend,
  getSessionVolume,
  getVolumeInLastDays,
} from '../sessionVolume';
import type { LoggedSet, WorkoutSession } from '../../../workout/types';

function set(weightKg: number, reps: number): LoggedSet {
  return { weightKg, reps, loggedAt: 0 };
}

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session',
    splitId: 'split',
    splitName: 'Push',
    startedAt: 1000,
    completedAt: 2000,
    exercises: [{ exerciseId: 'ex', exerciseName: 'Bench', sets: [set(100, 5)] }],
    ...overrides,
  };
}

describe('getSessionVolume', () => {
  it('sums weight × reps across every set', () => {
    const session = makeSession({
      exercises: [
        { exerciseId: 'a', exerciseName: 'Bench', sets: [set(100, 5), set(100, 3)] },
        { exerciseId: 'b', exerciseName: 'Row', sets: [set(50, 10)] },
      ],
    });
    expect(getSessionVolume(session)).toBe(100 * 5 + 100 * 3 + 50 * 10);
  });
});

describe('buildVolumeSeries', () => {
  it('drops zero-volume sessions and orders by completedAt ascending', () => {
    const sessions: WorkoutSession[] = [
      makeSession({ id: 's3', completedAt: 3000 }),
      makeSession({ id: 's1', completedAt: 1000 }),
      makeSession({ id: 'empty', completedAt: 2000, exercises: [] }),
    ];

    const series = buildVolumeSeries(sessions);

    expect(series.map((p) => p.date)).toEqual([1000, 3000]);
    expect(series.every((p) => p.volume === 500)).toBe(true);
  });

  it('falls back to startedAt when completedAt is null', () => {
    const series = buildVolumeSeries([
      makeSession({ id: 's', completedAt: null, startedAt: 777 }),
    ]);
    expect(series[0].date).toBe(777);
  });
});

describe('getLatestVolumeTrend', () => {
  it('returns null with fewer than two points', () => {
    expect(getLatestVolumeTrend([])).toBeNull();
    expect(getLatestVolumeTrend([{ date: 1, volume: 100, label: 'a' }])).toBeNull();
  });

  it('reports progress with a rounded percent delta', () => {
    const trend = getLatestVolumeTrend([
      { date: 1, volume: 100, label: 'a' },
      { date: 2, volume: 150, label: 'b' },
    ]);
    expect(trend).toEqual({ direction: 'progress', deltaPercent: 50, current: 150, previous: 100 });
  });

  it('reports neutral when volume is unchanged', () => {
    const trend = getLatestVolumeTrend([
      { date: 1, volume: 100, label: 'a' },
      { date: 2, volume: 100, label: 'b' },
    ]);
    expect(trend?.direction).toBe('neutral');
  });
});

describe('getVolumeInLastDays', () => {
  const NOW = 1_000_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;

  it('sums only sessions inside the window', () => {
    const sessions = [
      makeSession({ id: 'recent', completedAt: NOW - 2 * DAY }),
      makeSession({ id: 'old', completedAt: NOW - 30 * DAY }),
    ];
    // each makeSession is 100kg x 5 reps = 500
    expect(getVolumeInLastDays(sessions, 7, NOW)).toBe(500);
  });

  it('includes several sessions in the window', () => {
    const sessions = [
      makeSession({ id: 'a', completedAt: NOW - 1 * DAY }),
      makeSession({ id: 'b', completedAt: NOW - 6 * DAY }),
    ];
    expect(getVolumeInLastDays(sessions, 7, NOW)).toBe(1000);
  });

  it('ignores unfinished sessions', () => {
    expect(getVolumeInLastDays([makeSession({ id: 'x', completedAt: null })], 7, NOW)).toBe(0);
  });

  it('ignores sessions dated in the future', () => {
    expect(getVolumeInLastDays([makeSession({ id: 'f', completedAt: NOW + DAY })], 7, NOW)).toBe(0);
  });

  it('is zero with no history', () => {
    expect(getVolumeInLastDays([], 7, NOW)).toBe(0);
  });
});
