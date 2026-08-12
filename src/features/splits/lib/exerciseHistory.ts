import { formatSetWeightParts } from '../../../shared/lib/weight';
import type { WorkoutSession } from '../../workout/types';

/**
 * The last working set logged for an exercise, formatted for a list row
 * ("60 lbs × 6"), or null if it has never been logged.
 *
 * The split editor otherwise lists exercise names with no indication of what
 * you actually do on them, which is the information you need when deciding
 * whether the plan still makes sense.
 */
export function getLastSetForExercise(
  sessions: WorkoutSession[],
  exerciseId: string,
  weightUnit: 'kg' | 'lbs',
): string | null {
  let bestCompletedAt = -Infinity;
  let bestLabel: string | null = null;

  for (const session of sessions) {
    const completedAt = session.completedAt;
    if (completedAt === null || completedAt === undefined) continue;
    if (completedAt <= bestCompletedAt) continue;

    const exercise = session.exercises.find(
      (candidate) =>
        candidate.exerciseId === exerciseId ||
        candidate.substitutedForExerciseId === exerciseId,
    );
    if (!exercise || exercise.sets.length === 0) continue;

    const set = exercise.sets[0];
    const { weightText, unitLabel } = formatSetWeightParts(set, weightUnit);
    bestCompletedAt = completedAt;
    bestLabel = `${weightText} ${unitLabel} × ${set.reps}`;
  }

  return bestLabel;
}
