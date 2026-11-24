import { describe, expect, it } from 'vitest';
import {
  applyPreviousOrder,
  buildPreviousExerciseOrder,
  matchesPreviousOrder,
} from '../lib/previousExerciseOrder';
import type { LoggedExercise, WorkoutSession } from '../types';

function ex(
  exerciseId: string,
  firstLoggedAt?: number,
  overrides: Partial<LoggedExercise> = {},
): LoggedExercise {
  return {
    exerciseId,
    exerciseName: exerciseId.toUpperCase(),
    sets: firstLoggedAt === undefined ? [] : [{ weightKg: 80, reps: 8, loggedAt: firstLoggedAt }],
    ...(firstLoggedAt === undefined ? {} : { firstLoggedAt }),
    ...overrides,
  };
}

function session(exercises: LoggedExercise[]): WorkoutSession {
  return {
    id: 'prev',
    splitId: 'sp1',
    splitName: 'Push',
    startedAt: 1000,
    completedAt: 5000,
    exercises,
  };
}

describe('buildPreviousExerciseOrder', () => {
  it('numbers exercises by the order they were actually performed', () => {
    // Template order a, b, c — performed c, a, b.
    const prev = session([ex('a', 200), ex('b', 300), ex('c', 100)]);
    const { positionById, orderedIds } = buildPreviousExerciseOrder(prev);

    expect(orderedIds).toEqual(['c', 'a', 'b']);
    expect(positionById.get('c')).toBe(1);
    expect(positionById.get('a')).toBe(2);
    expect(positionById.get('b')).toBe(3);
  });

  it('skips exercises that were never logged', () => {
    const prev = session([ex('a', 100), ex('skipped'), ex('b', 200)]);
    const { positionById, orderedIds } = buildPreviousExerciseOrder(prev);

    expect(orderedIds).toEqual(['a', 'b']);
    expect(positionById.has('skipped')).toBe(false);
    expect(positionById.get('b')).toBe(2);
  });

  it('maps a substitute back to the exercise it replaced', () => {
    const prev = session([
      ex('a', 100),
      ex('incline', 200, { substitutedForExerciseId: 'flat', substitutedForExerciseName: 'Flat' }),
    ]);
    const { positionById } = buildPreviousExerciseOrder(prev);

    expect(positionById.get('flat')).toBe(2);
    expect(positionById.has('incline')).toBe(false);
  });

  it('returns nothing when there is no previous session', () => {
    expect(buildPreviousExerciseOrder(null).orderedIds).toEqual([]);
  });
});

describe('applyPreviousOrder', () => {
  it('rearranges this session into last session order', () => {
    const current = [ex('a'), ex('b'), ex('c')];
    const result = applyPreviousOrder(current, ['c', 'a', 'b']);

    expect(result.map((e) => e.exerciseId)).toEqual(['c', 'a', 'b']);
  });

  it('keeps exercises absent from last week behind, in their current order', () => {
    const current = [ex('new1'), ex('a'), ex('new2'), ex('b')];
    const result = applyPreviousOrder(current, ['b', 'a']);

    expect(result.map((e) => e.exerciseId)).toEqual(['b', 'a', 'new1', 'new2']);
  });

  it('ignores ids that are not in this session', () => {
    const current = [ex('a'), ex('b')];
    const result = applyPreviousOrder(current, ['gone', 'b', 'also-gone', 'a']);

    expect(result.map((e) => e.exerciseId)).toEqual(['b', 'a']);
  });

  it('routes a substitute to the planned slot', () => {
    const current = [ex('a'), ex('incline', undefined, { substitutedForExerciseId: 'flat' })];
    const result = applyPreviousOrder(current, ['flat', 'a']);

    expect(result.map((e) => e.exerciseId)).toEqual(['incline', 'a']);
  });

  it('is a no-op with no previous order', () => {
    const current = [ex('a'), ex('b')];
    expect(applyPreviousOrder(current, [])).toBe(current);
  });
});

describe('matchesPreviousOrder', () => {
  it('is true when nothing would move', () => {
    const current = [ex('a'), ex('b'), ex('c')];
    expect(matchesPreviousOrder(current, ['a', 'b'])).toBe(true);
    expect(matchesPreviousOrder(current, [])).toBe(true);
  });

  it('is false when the order differs', () => {
    const current = [ex('a'), ex('b')];
    expect(matchesPreviousOrder(current, ['b', 'a'])).toBe(false);
  });
});
