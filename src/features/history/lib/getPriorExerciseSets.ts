import type { LoggedSet, WorkoutSession } from '../../workout/types';

export function getPriorExerciseSets(
  session: WorkoutSession,
  exerciseId: string,
  allSessions: WorkoutSession[],
): LoggedSet[] | null {
  const sessionCompletedAt = session.completedAt ?? 0;

  const candidates = allSessions
    .filter(
      (s) =>
        s.completedAt !== null &&
        s.id !== session.id &&
        (s.completedAt ?? 0) < sessionCompletedAt,
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  for (const priorSession of candidates) {
    const exercise = priorSession.exercises.find((e) => e.exerciseId === exerciseId);
    if (exercise && exercise.sets.length > 0) return exercise.sets;
  }

  return null;
}
