import { describe, expect, it } from 'vitest';
import { rankExerciseMomentum } from '../exerciseMomentum';
import type { Exercise } from '../../../splits/types';
import type { WorkoutSession } from '../../../workout/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-10T12:00:00Z').getTime();

function exercise(id: string, name = id): Exercise {
  return { id, name, updatedAt: 1 };
}

/** One session logging a single first set of `exerciseId`. */
function session(input: {
  id: string;
  exerciseId: string;
  daysAgo: number;
  weightKg: number;
  reps: number;
  name?: string;
}): WorkoutSession {
  const completedAt = NOW - input.daysAgo * DAY;
  return {
    id: input.id,
    splitId: 'split-1',
    splitName: 'Push',
    startedAt: completedAt - 3600_000,
    completedAt,
    updatedAt: completedAt,
    exercises: [
      {
        exerciseId: input.exerciseId,
        exerciseName: input.name ?? input.exerciseId,
        sets: [{ reps: input.reps, weightKg: input.weightKg, loggedAt: completedAt }],
      },
    ],
  };
}

/** Builds N sessions for one exercise from a list of [daysAgo, weightKg] pairs. */
function seriesFor(
  exerciseId: string,
  points: Array<[daysAgo: number, weightKg: number]>,
): WorkoutSession[] {
  return points.map(([daysAgo, weightKg], i) =>
    session({ id: `${exerciseId}-${i}`, exerciseId, daysAgo, weightKg, reps: 5 }),
  );
}

describe('rankExerciseMomentum', () => {
  it('returns empty buckets with no data', () => {
    const result = rankExerciseMomentum({ exercises: [], sessions: [], now: NOW });
    expect(result).toEqual({ rising: [], stalled: [], prs: [] });
  });

  it('needs at least 3 sessions before bucketing a lift', () => {
    const exercises = [exercise('squat')];
    const sessions = seriesFor('squat', [
      [20, 100],
      [10, 110],
    ]);

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.rising).toHaveLength(0);
    expect(result.stalled).toHaveLength(0);
  });

  it('buckets a climbing lift as rising', () => {
    const exercises = [exercise('squat')];
    const sessions = seriesFor('squat', [
      [30, 100],
      [20, 110],
      [10, 120],
    ]);

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.rising.map((r) => r.exerciseId)).toEqual(['squat']);
    expect(result.rising[0].trend?.direction).toBe('up');
    expect(result.stalled).toHaveLength(0);
  });

  it('buckets a flat lift as stalled', () => {
    const exercises = [exercise('bench')];
    const sessions = seriesFor('bench', [
      [30, 100],
      [20, 100],
      [10, 100],
    ]);

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.stalled.map((r) => r.exerciseId)).toEqual(['bench']);
    expect(result.rising).toHaveLength(0);
  });

  it('buckets a declining lift as stalled', () => {
    const exercises = [exercise('row')];
    const sessions = seriesFor('row', [
      [30, 120],
      [20, 110],
      [10, 100],
    ]);

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.stalled.map((r) => r.exerciseId)).toEqual(['row']);
  });

  it('drops an abandoned lift out of stalled rather than nagging about it', () => {
    const exercises = [exercise('curl')];
    // Flat, but nothing logged in 90+ days.
    const sessions = seriesFor('curl', [
      [120, 40],
      [110, 40],
      [100, 40],
    ]);

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.stalled).toHaveLength(0);
  });

  it('sorts each bucket by the size of the move', () => {
    const exercises = [exercise('small'), exercise('big')];
    const sessions = [
      ...seriesFor('small', [
        [30, 100],
        [20, 102],
        [10, 105],
      ]),
      ...seriesFor('big', [
        [30, 100],
        [20, 130],
        [10, 160],
      ]),
    ];

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.rising.map((r) => r.exerciseId)).toEqual(['big', 'small']);
  });

  it('caps a bucket at five rows', () => {
    const exercises = Array.from({ length: 8 }, (_, i) => exercise(`ex-${i}`));
    const sessions = exercises.flatMap((ex, i) =>
      seriesFor(ex.id, [
        [30, 100],
        [20, 100 + i + 5],
        [10, 100 + (i + 5) * 2],
      ]),
    );

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.rising).toHaveLength(5);
  });

  it('flags a recent personal best', () => {
    const exercises = [exercise('deadlift')];
    const sessions = seriesFor('deadlift', [
      [30, 140],
      [20, 150],
      [5, 180],
    ]);

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.prs.map((r) => r.exerciseId)).toEqual(['deadlift']);
  });

  it('does not flag a personal best older than the 30-day window', () => {
    const exercises = [exercise('deadlift')];
    const sessions = seriesFor('deadlift', [
      [120, 140],
      [110, 150],
      [100, 180],
    ]);

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.prs).toHaveLength(0);
  });

  it('ranks a lift that history has but no split still lists', () => {
    // removeExerciseFromSplit leaves the catalog row in place, so a lift
    // dropped from every split still has a live progress screen to open.
    const exercises = [exercise('orphan', 'Cable Fly')];
    const sessions = seriesFor('orphan', [
      [30, 20],
      [20, 25],
      [10, 30],
    ]);

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(result.rising.map((r) => r.name)).toEqual(['Cable Fly']);
  });

  it('ignores an exercise the catalog no longer has', () => {
    // deleteSplit tombstones its exclusive exercises; ranking from
    // history ids would produce a row whose screen renders "not found".
    const sessions = seriesFor('deleted', [
      [30, 100],
      [20, 110],
      [10, 120],
    ]);

    const result = rankExerciseMomentum({ exercises: [], sessions, now: NOW });
    expect(result.rising).toHaveLength(0);
    expect(result.prs).toHaveLength(0);
  });

  it('ignores sessions with no logged sets', () => {
    const exercises = [exercise('squat')];
    const sessions = seriesFor('squat', [
      [30, 100],
      [20, 110],
      [10, 120],
    ]);
    const empty: WorkoutSession = {
      ...sessions[0],
      id: 'empty',
      exercises: [{ exerciseId: 'squat', exerciseName: 'squat', sets: [] }],
    };

    const withEmpty = rankExerciseMomentum({
      exercises,
      sessions: [...sessions, empty],
      now: NOW,
    });
    const without = rankExerciseMomentum({ exercises, sessions, now: NOW });
    expect(withEmpty.rising[0].values).toEqual(without.rising[0].values);
  });

  it('carries the series and last-logged time for the row preview', () => {
    const exercises = [exercise('squat')];
    const sessions = seriesFor('squat', [
      [30, 100],
      [20, 110],
      [10, 120],
    ]);

    const result = rankExerciseMomentum({ exercises, sessions, now: NOW });
    const row = result.rising[0];
    expect(row.values).toHaveLength(3);
    expect(row.lastLoggedAt).toBe(NOW - 10 * DAY);
  });
});
