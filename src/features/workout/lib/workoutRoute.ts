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

/** Incomplete session explicitly paused via Leave Workout. */
export function hasPausedSession(session: WorkoutSession | null): boolean {
  return isIncompleteActiveSession(session) && session.pausedAt != null;
}

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
