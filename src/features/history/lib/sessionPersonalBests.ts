import { buildFirstSetSeries, isPersonalBest } from '../../progress/lib/firstSetProgress';
import type { WorkoutSession } from '../../workout/types';

/**
 * Which exercises in `session` were all-time bests.
 *
 * Reuses the same series + comparison the Trends tab ranks on, so a PR
 * called out here is the same PR that shows up there — rather than a second
 * definition that could drift. `isPersonalBest` already returns false for a
 * single-session series, so a first-ever lift is not announced as a record.
 *
 * `session` must already be in `allSessions`; it is the latest point in each
 * series, which is the point `isPersonalBest` compares against the rest.
 */
export function getSessionPersonalBests(
  session: WorkoutSession,
  allSessions: WorkoutSession[],
): string[] {
  const names: string[] = [];

  for (const exercise of session.exercises) {
    if (exercise.sets.length === 0) continue;
    const points = buildFirstSetSeries(allSessions, exercise.exerciseId, 'all');
    // The series is ordered oldest-first; only count it when this session is
    // the one sitting at the end of it.
    const latest = points[points.length - 1];
    if (!latest || latest.sessionId !== session.id) continue;
    if (isPersonalBest(points)) names.push(exercise.exerciseName);
  }

  return names;
}

/** "Bench Press", "Bench Press and Squat", "Bench Press, Squat and Row". */
export function formatPersonalBestNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
