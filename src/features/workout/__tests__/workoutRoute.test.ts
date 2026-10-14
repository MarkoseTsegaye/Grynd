import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../types';
import {
  hasPausedSession,
  isIncompleteActiveSession,
  isWorkoutRoute,
} from '../lib/workoutRoute';

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    splitId: 'split-1',
    splitName: 'Push Day',
    startedAt: 1000,
    completedAt: null,
    exercises: [],
    ...overrides,
  };
}

describe('isWorkoutRoute', () => {
  it('returns true for workout paths', () => {
    expect(isWorkoutRoute('/workout/split-1')).toBe(true);
    expect(isWorkoutRoute('/workout/abc/extra')).toBe(true);
  });

  it('returns false for non-workout paths', () => {
    expect(isWorkoutRoute('/')).toBe(false);
    expect(isWorkoutRoute('/(tabs)')).toBe(false);
    expect(isWorkoutRoute('/cycle')).toBe(false);
    expect(isWorkoutRoute('/workout')).toBe(false);
  });
});

describe('hasPausedSession', () => {
  it('returns true for incomplete sessions with pausedAt', () => {
    expect(hasPausedSession(makeSession({ pausedAt: 5000 }))).toBe(true);
  });

  it('returns false for legacy incomplete sessions without pausedAt', () => {
    expect(hasPausedSession(makeSession())).toBe(false);
  });

  it('returns false for completed sessions', () => {
    expect(hasPausedSession(makeSession({ completedAt: 9000 }))).toBe(false);
  });

  it('returns false for null session', () => {
    expect(hasPausedSession(null)).toBe(false);
  });
});

describe('isIncompleteActiveSession', () => {
  it('narrows incomplete sessions', () => {
    const session = makeSession();
    expect(isIncompleteActiveSession(session)).toBe(true);
    if (isIncompleteActiveSession(session)) {
      expect(session.completedAt).toBeNull();
    }
  });
});
