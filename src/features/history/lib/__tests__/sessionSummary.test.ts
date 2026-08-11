import { describe, expect, it } from 'vitest';
import {
  filterSessionsBySplit,
  formatDuration,
  formatSessionDuration,
  getSessionSetCount,
  getSessionSummary,
  getSplitFilters,
  isEmptySession,
  pluralize,
} from '../sessionSummary';
import type { LoggedSet, WorkoutSession } from '../../../workout/types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function set(weightKg: number, reps: number): LoggedSet {
  return { weightKg, reps, loggedAt: 0 };
}

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session',
    splitId: 'split',
    splitName: 'Push',
    startedAt: 0,
    completedAt: 52 * MINUTE,
    exercises: [{ exerciseId: 'ex', exerciseName: 'Bench', sets: [set(100, 5)] }],
    ...overrides,
  };
}

describe('pluralize', () => {
  it('uses the singular for exactly one', () => {
    expect(pluralize(1, 'set')).toBe('1 set');
  });

  it('pluralizes zero and many', () => {
    expect(pluralize(0, 'set')).toBe('0 sets');
    expect(pluralize(9, 'set')).toBe('9 sets');
  });

  it('accepts an explicit plural', () => {
    expect(pluralize(2, 'exercise', 'exercises')).toBe('2 exercises');
  });
});

describe('getSessionSetCount', () => {
  it('sums sets across all exercises', () => {
    const session = makeSession({
      exercises: [
        { exerciseId: 'a', exerciseName: 'Bench', sets: [set(100, 5), set(100, 3)] },
        { exerciseId: 'b', exerciseName: 'Row', sets: [set(50, 10)] },
      ],
    });
    expect(getSessionSetCount(session)).toBe(3);
  });

  it('is zero when no sets were logged', () => {
    const session = makeSession({
      exercises: [{ exerciseId: 'a', exerciseName: 'Bench', sets: [] }],
    });
    expect(getSessionSetCount(session)).toBe(0);
    expect(isEmptySession(session)).toBe(true);
  });
});

describe('formatDuration', () => {
  it('formats sub-hour durations in minutes', () => {
    expect(formatDuration(52 * MINUTE)).toBe('52m');
  });

  it('rounds to the nearest minute', () => {
    expect(formatDuration(52 * MINUTE + 40_000)).toBe('53m');
  });

  it('shows a floor for very short sessions', () => {
    expect(formatDuration(20_000)).toBe('<1m');
  });

  it('splits hours and minutes', () => {
    expect(formatDuration(HOUR + 12 * MINUTE)).toBe('1h 12m');
  });

  it('drops a zero minute remainder', () => {
    expect(formatDuration(2 * HOUR)).toBe('2h');
  });

  it('returns null for non-positive durations', () => {
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(-1000)).toBeNull();
  });

  it('returns null for implausibly long sessions (forgotten timer)', () => {
    expect(formatDuration(13 * HOUR)).toBeNull();
  });
});

describe('formatSessionDuration', () => {
  it('measures from startedAt to completedAt', () => {
    expect(formatSessionDuration(makeSession({ startedAt: HOUR, completedAt: 2 * HOUR }))).toBe(
      '1h',
    );
  });

  it('returns null while a session is still in progress', () => {
    expect(formatSessionDuration(makeSession({ completedAt: null }))).toBeNull();
  });
});

describe('getSessionSummary', () => {
  it('reports sets, volume and duration in the display unit', () => {
    const session = makeSession({
      startedAt: 0,
      completedAt: 52 * MINUTE,
      exercises: [{ exerciseId: 'a', exerciseName: 'Bench', sets: [set(100, 5)] }],
    });

    const kg = getSessionSummary(session, 'kg');
    expect(kg.setCount).toBe(1);
    expect(kg.setCountText).toBe('1 set');
    expect(kg.volumeText).toBe('500');
    expect(kg.volumeLabel).toBe('kg·reps');
    expect(kg.durationText).toBe('52m');

    // 500 kg·reps ≈ 1102 lb·reps -> abbreviated to 1.1k
    const lbs = getSessionSummary(session, 'lbs');
    expect(lbs.volumeText).toBe('1.1k');
    expect(lbs.volumeLabel).toBe('lb·reps');
  });

  it('counts exercises separately from sets', () => {
    const session = makeSession({
      exercises: [
        { exerciseId: 'a', exerciseName: 'Bench', sets: [set(100, 5), set(100, 5)] },
        { exerciseId: 'b', exerciseName: 'Row', sets: [set(50, 10)] },
      ],
    });
    const summary = getSessionSummary(session, 'kg');
    expect(summary.exerciseCount).toBe(2);
    expect(summary.setCount).toBe(3);
  });
});

describe('getSplitFilters', () => {
  it('returns distinct split names in session order', () => {
    const sessions = [
      makeSession({ id: '1', splitName: 'Push' }),
      makeSession({ id: '2', splitName: 'Legs' }),
      makeSession({ id: '3', splitName: 'Push' }),
    ];
    expect(getSplitFilters(sessions)).toEqual(['Push', 'Legs']);
  });

  it('ignores blank split names', () => {
    const sessions = [makeSession({ id: '1', splitName: '  ' }), makeSession({ id: '2' })];
    expect(getSplitFilters(sessions)).toEqual(['Push']);
  });
});

describe('filterSessionsBySplit', () => {
  const sessions = [
    makeSession({ id: '1', splitName: 'Push' }),
    makeSession({ id: '2', splitName: 'Legs' }),
  ];

  it('returns everything when no split is selected', () => {
    expect(filterSessionsBySplit(sessions, null)).toHaveLength(2);
  });

  it('keeps only matching sessions', () => {
    expect(filterSessionsBySplit(sessions, 'Legs').map((s) => s.id)).toEqual(['2']);
  });
});
