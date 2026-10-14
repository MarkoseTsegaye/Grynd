import { describe, it, expect } from 'vitest';
import { formatPersonalBestNames, getSessionPersonalBests } from '../sessionPersonalBests';
import type { WorkoutSession } from '../../../workout/types';

const DAY = 86400000;
const now = Date.now();

function session(
  id: string,
  daysAgo: number,
  exercises: { id: string; name: string; weightKg: number; reps: number }[],
): WorkoutSession {
  const at = now - daysAgo * DAY;
  return {
    id,
    splitId: 'sp1',
    splitName: 'Push',
    startedAt: at - 3600000,
    completedAt: at,
    updatedAt: at,
    exercises: exercises.map((e) => ({
      exerciseId: e.id,
      exerciseName: e.name,
      sets: [{ weightKg: e.weightKg, reps: e.reps, loggedAt: at }],
    })),
  };
}

describe('getSessionPersonalBests', () => {
  it('names an exercise that beat every previous session', () => {
    const older = session('s1', 14, [{ id: 'e1', name: 'Bench Press', weightKg: 80, reps: 8 }]);
    const latest = session('s2', 0, [{ id: 'e1', name: 'Bench Press', weightKg: 85, reps: 8 }]);

    expect(getSessionPersonalBests(latest, [older, latest])).toEqual(['Bench Press']);
  });

  it('says nothing for a lift that did not beat its history', () => {
    const older = session('s1', 14, [{ id: 'e1', name: 'Bench Press', weightKg: 90, reps: 8 }]);
    const latest = session('s2', 0, [{ id: 'e1', name: 'Bench Press', weightKg: 85, reps: 8 }]);

    expect(getSessionPersonalBests(latest, [older, latest])).toEqual([]);
  });

  it('does not call a first-ever lift a personal best', () => {
    const only = session('s1', 0, [{ id: 'e1', name: 'Bench Press', weightKg: 80, reps: 8 }]);

    expect(getSessionPersonalBests(only, [only])).toEqual([]);
  });

  it('counts more reps at the same load', () => {
    const older = session('s1', 14, [{ id: 'e1', name: 'Bench Press', weightKg: 80, reps: 8 }]);
    const latest = session('s2', 0, [{ id: 'e1', name: 'Bench Press', weightKg: 80, reps: 10 }]);

    expect(getSessionPersonalBests(latest, [older, latest])).toEqual(['Bench Press']);
  });

  it('reports several in one session', () => {
    const older = session('s1', 14, [
      { id: 'e1', name: 'Bench Press', weightKg: 80, reps: 8 },
      { id: 'e2', name: 'Squat', weightKg: 100, reps: 5 },
    ]);
    const latest = session('s2', 0, [
      { id: 'e1', name: 'Bench Press', weightKg: 85, reps: 8 },
      { id: 'e2', name: 'Squat', weightKg: 105, reps: 5 },
    ]);

    expect(getSessionPersonalBests(latest, [older, latest])).toEqual(['Bench Press', 'Squat']);
  });

  it('skips exercises with no sets logged', () => {
    const latest = session('s2', 0, [{ id: 'e1', name: 'Bench Press', weightKg: 85, reps: 8 }]);
    latest.exercises.push({ exerciseId: 'e9', exerciseName: 'Skipped', sets: [] });
    const older = session('s1', 14, [{ id: 'e1', name: 'Bench Press', weightKg: 80, reps: 8 }]);

    expect(getSessionPersonalBests(latest, [older, latest])).toEqual(['Bench Press']);
  });

  it('ignores a session that is not the latest for that exercise', () => {
    const older = session('s1', 14, [{ id: 'e1', name: 'Bench Press', weightKg: 80, reps: 8 }]);
    const middle = session('s2', 7, [{ id: 'e1', name: 'Bench Press', weightKg: 85, reps: 8 }]);
    const newest = session('s3', 0, [{ id: 'e1', name: 'Bench Press', weightKg: 90, reps: 8 }]);

    // s2 beat s1, but it is no longer the end of the series.
    expect(getSessionPersonalBests(middle, [older, middle, newest])).toEqual([]);
    expect(getSessionPersonalBests(newest, [older, middle, newest])).toEqual(['Bench Press']);
  });
});

describe('formatPersonalBestNames', () => {
  it('reads as a sentence', () => {
    expect(formatPersonalBestNames([])).toBe('');
    expect(formatPersonalBestNames(['Bench Press'])).toBe('Bench Press');
    expect(formatPersonalBestNames(['Bench Press', 'Squat'])).toBe('Bench Press and Squat');
    expect(formatPersonalBestNames(['Bench Press', 'Squat', 'Row'])).toBe(
      'Bench Press, Squat and Row',
    );
  });
});
