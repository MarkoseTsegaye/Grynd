import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../types';
import {
  COLD_START_GUARD_MS,
  hasPausedSession,
  isIncompleteActiveSession,
  isWorkoutRoute,
  shouldPromptResumeSession,
  shouldSuppressForegroundPrompt,
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

describe('shouldSuppressForegroundPrompt', () => {
  it('suppresses when within cold-start guard window', () => {
    const coldStartAt = 10_000;
    const now = coldStartAt + COLD_START_GUARD_MS - 1;
    expect(shouldSuppressForegroundPrompt(coldStartAt, now)).toBe(true);
  });

  it('does not suppress after cold-start guard window', () => {
    const coldStartAt = 10_000;
    const now = coldStartAt + COLD_START_GUARD_MS;
    expect(shouldSuppressForegroundPrompt(coldStartAt, now)).toBe(false);
  });

  it('does not suppress when no cold-start prompt occurred', () => {
    expect(shouldSuppressForegroundPrompt(null, Date.now())).toBe(false);
  });
});

describe('hasPausedSession', () => {
  it('returns true for incomplete sessions with pausedAt', () => {
    expect(hasPausedSession(makeSession({ pausedAt: 5000 }))).toBe(true);
  });

  it('returns true for legacy incomplete sessions without pausedAt', () => {
    expect(hasPausedSession(makeSession())).toBe(true);
  });

  it('returns false for completed sessions', () => {
    expect(hasPausedSession(makeSession({ completedAt: 9000 }))).toBe(false);
  });

  it('returns false for null session', () => {
    expect(hasPausedSession(null)).toBe(false);
  });
});

describe('shouldPromptResumeSession', () => {
  it('prompts when paused session exists off workout route', () => {
    expect(shouldPromptResumeSession(makeSession({ pausedAt: 5000 }), '/(tabs)')).toBe(true);
  });

  it('does not prompt on workout route', () => {
    expect(shouldPromptResumeSession(makeSession({ pausedAt: 5000 }), '/workout/split-1')).toBe(
      false,
    );
  });

  it('does not prompt when session is complete', () => {
    expect(shouldPromptResumeSession(makeSession({ completedAt: 9000 }), '/(tabs)')).toBe(false);
  });

  it('prompts for legacy incomplete sessions off workout route', () => {
    expect(shouldPromptResumeSession(makeSession(), '/')).toBe(true);
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
