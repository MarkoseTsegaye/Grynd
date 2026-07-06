import { describe, expect, it } from 'vitest';
import {
  buildVolumeSeries,
  getLatestVolumeTrend,
  getSessionVolume,
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
