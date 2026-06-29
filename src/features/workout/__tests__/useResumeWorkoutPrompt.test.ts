import { describe, expect, it } from 'vitest';
import {
  COLD_START_GUARD_MS,
  isWorkoutRoute,
  shouldSuppressForegroundPrompt,
} from '../lib/workoutRoute';

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
