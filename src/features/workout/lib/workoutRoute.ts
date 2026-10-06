import type { WorkoutSession } from '../types';

export const COLD_START_GUARD_MS = 2000;

export function isWorkoutRoute(pathname: string): boolean {
  return pathname.startsWith('/workout/');
}

export function isIncompleteActiveSession(
  session: WorkoutSession | null,
): session is WorkoutSession {
  return session !== null && session.completedAt === null;
}

/**
 * Incomplete session explicitly parked via Leave Workout. Still the right
 * check for `shouldPreventLeave` — a session the user already chose to
 * leave shouldn't re-prompt — but nothing gates *visibility* on it.
 */
export function hasPausedSession(session: WorkoutSession | null): boolean {
  return isIncompleteActiveSession(session) && session.pausedAt != null;
}

/**
 * The interrupting launch dialog stays narrow: it asks only about a session
 * the user explicitly parked via Leave Workout, where "resume or discard?"
 * is a question they already half-asked.
 *
 * Sessions left behind some other way — a killed app, a closed PWA tab —
 * are surfaced by `ActiveWorkoutBanner` instead. Widening this to every
 * unfinished session would mean a modal on every launch mid-workout, which
 * is a worse answer to "always show it" than a banner that never blocks.
 */
export function shouldPromptResumeSession(
  session: WorkoutSession | null,
  pathname: string,
): boolean {
  if (!hasPausedSession(session)) return false;
  return !isWorkoutRoute(pathname);
}

/** Skip foreground resume prompt when cold-start prompt fired recently. */
export function shouldSuppressForegroundPrompt(
  coldStartPromptAt: number | null,
  now: number,
  guardMs: number = COLD_START_GUARD_MS,
): boolean {
  return coldStartPromptAt !== null && now - coldStartPromptAt < guardMs;
}
