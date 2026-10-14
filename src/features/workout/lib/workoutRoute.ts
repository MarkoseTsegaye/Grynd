import type { WorkoutSession } from '../types';

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
