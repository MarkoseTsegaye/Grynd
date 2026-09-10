import { describe, it, expect } from 'vitest';
import { groupSessionsByPeriod } from '../groupSessions';
import type { WorkoutSession } from '../../../workout/types';

/** Wed 9 Sep 2026 — its Monday-start week begins Mon 7 Sep. */
const NOW = new Date(2026, 8, 9, 12, 0).getTime();

function at(year: number, monthIndex: number, day: number, hour = 12): number {
  return new Date(year, monthIndex, day, hour).getTime();
}

function session(id: string, completedAt: number | null, startedAt = completedAt ?? 0): WorkoutSession {
  return {
    id,
    splitId: 'split-1',
    splitName: 'Push',
    startedAt,
    completedAt,
    exercises: [
      {
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        sets: [{ reps: 8, weightKg: 100, loggedAt: startedAt }],
      },
    ],
  };
}

describe('groupSessionsByPeriod', () => {
  it('returns no sections for an empty history', () => {
    expect(groupSessionsByPeriod([], NOW)).toEqual([]);
  });

  it('buckets the current Monday-start week as "This week", inclusive of Monday', () => {
    const sections = groupSessionsByPeriod(
      [session('a', at(2026, 8, 9)), session('b', new Date(2026, 8, 7, 0, 0).getTime())],
      NOW,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('This week');
    expect(sections[0].data.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('puts the Sunday before this week into "Last week"', () => {
    const sections = groupSessionsByPeriod(
      [session('sun', at(2026, 8, 6, 23)), session('wed', at(2026, 8, 9))],
      NOW,
    );
    expect(sections.map((s) => s.title)).toEqual(['This week', 'Last week']);
    expect(sections[1].data.map((s) => s.id)).toEqual(['sun']);
  });

  it('falls back to a month bucket beyond two weeks, crossing the month boundary', () => {
    // Mon 31 Aug starts last week; Sun 30 Aug is already older than that.
    const sections = groupSessionsByPeriod(
      [session('mon', at(2026, 7, 31)), session('sun', at(2026, 7, 30))],
      NOW,
    );
    expect(sections.map((s) => s.title)).toEqual(['Last week', 'August 2026']);
    expect(sections[1].data.map((s) => s.id)).toEqual(['sun']);
  });

  it('keeps the year in month titles so the same month in two years stays distinct', () => {
    const sections = groupSessionsByPeriod(
      [session('new', at(2026, 5, 10)), session('old', at(2025, 5, 10))],
      NOW,
    );
    expect(sections.map((s) => s.title)).toEqual(['June 2026', 'June 2025']);
  });

  it('sorts newest first regardless of input order', () => {
    const sections = groupSessionsByPeriod(
      [session('older', at(2026, 8, 7)), session('newest', at(2026, 8, 9)), session('mid', at(2026, 8, 8))],
      NOW,
    );
    expect(sections[0].data.map((s) => s.id)).toEqual(['newest', 'mid', 'older']);
  });

  it('buckets by completedAt, not startedAt', () => {
    // Started last week, finished this week — belongs to this week.
    const sections = groupSessionsByPeriod(
      [session('overnight', at(2026, 8, 7, 1), at(2026, 8, 6, 23))],
      NOW,
    );
    expect(sections[0].title).toBe('This week');
  });

  it('keeps sessions with no logged sets — swipe-delete is the only way to remove them', () => {
    const empty = session('empty', at(2026, 8, 9));
    empty.exercises = [];
    const sections = groupSessionsByPeriod([empty], NOW);
    expect(sections[0].data.map((s) => s.id)).toEqual(['empty']);
  });
});
