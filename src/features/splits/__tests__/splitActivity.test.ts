import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  formatRelativeDay,
  getLastPerformedAt,
  getSplitActivity,
} from '../lib/splitActivity';
import type { WorkoutSession } from '../../workout/types';

const NOW = new Date('2026-08-11T15:00:00').getTime();
const DAY = 24 * 60 * 60 * 1000;

function session(id: string, splitId: string, completedAt: number | null): WorkoutSession {
  return {
    id,
    splitId,
    splitName: splitId,
    startedAt: (completedAt ?? NOW) - 3_600_000,
    completedAt,
    exercises: [],
  };
}

describe('getLastPerformedAt', () => {
  const sessions = [
    session('a', 'push', NOW - 10 * DAY),
    session('b', 'push', NOW - 2 * DAY),
    session('c', 'legs', NOW - 1 * DAY),
  ];

  it('returns the most recent session for the split', () => {
    expect(getLastPerformedAt(sessions, 'push')).toBe(NOW - 2 * DAY);
  });

  it('ignores other splits', () => {
    expect(getLastPerformedAt(sessions, 'legs')).toBe(NOW - 1 * DAY);
  });

  it('returns null for a split never performed', () => {
    expect(getLastPerformedAt(sessions, 'pull')).toBeNull();
  });

  it('ignores sessions still in progress', () => {
    expect(getLastPerformedAt([session('x', 'pull', null)], 'pull')).toBeNull();
  });

  it('handles an empty history', () => {
    expect(getLastPerformedAt([], 'push')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('counts calendar days, not 24h blocks', () => {
    // 11pm yesterday -> 1am today is 2 hours but one calendar day
    const lateYesterday = new Date('2026-08-10T23:00:00').getTime();
    const earlyToday = new Date('2026-08-11T01:00:00').getTime();
    expect(daysBetween(lateYesterday, earlyToday)).toBe(1);
  });

  it('is zero within the same day', () => {
    const morning = new Date('2026-08-11T08:00:00').getTime();
    expect(daysBetween(morning, NOW)).toBe(0);
  });
});

describe('formatRelativeDay', () => {
  it('names the very recent past', () => {
    expect(formatRelativeDay(NOW, NOW)).toBe('Today');
    expect(formatRelativeDay(NOW - 1 * DAY, NOW)).toBe('Yesterday');
    expect(formatRelativeDay(NOW - 3 * DAY, NOW)).toBe('3 days ago');
  });

  it('summarises the week before', () => {
    expect(formatRelativeDay(NOW - 9 * DAY, NOW)).toBe('Last week');
  });

  it('falls back to a date once day counts stop helping', () => {
    expect(formatRelativeDay(NOW - 40 * DAY, NOW)).toMatch(/^[A-Z][a-z]{2} \d+$/);
  });

  it('reads a future timestamp as Today rather than negative days', () => {
    expect(formatRelativeDay(NOW + 2 * DAY, NOW)).toBe('Today');
  });
});

describe('getSplitActivity', () => {
  it('pairs the timestamp with its label', () => {
    const result = getSplitActivity([session('a', 'push', NOW - 1 * DAY)], 'push', NOW);
    expect(result.lastPerformedAt).toBe(NOW - 1 * DAY);
    expect(result.label).toBe('Yesterday');
  });

  it('has no label when never performed', () => {
    expect(getSplitActivity([], 'push', NOW)).toEqual({ lastPerformedAt: null, label: null });
  });
});
