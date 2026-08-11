import type { LoggedSet } from '../../workout/types';

export type SetComparisonResult = {
  direction: 'progress' | 'decline';
  arrowCount: 1 | 2 | 3;
} | null;

export function compareSets(prev: LoggedSet, current: LoggedSet): SetComparisonResult {
  const weightSame = prev.weightKg === current.weightKg;
  const repsSame = prev.reps === current.reps;

  if (weightSame && repsSame) return null;

  let direction: 'progress' | 'decline';
  if (current.weightKg > prev.weightKg) {
    direction = 'progress';
  } else if (current.weightKg < prev.weightKg) {
    direction = 'decline';
  } else if (current.reps > prev.reps) {
    direction = 'progress';
  } else if (current.reps < prev.reps) {
    direction = 'decline';
  } else {
    return null;
  }

  const weightChanged = !weightSame;
  const repsChanged = !repsSame;

  if (!weightChanged || !repsChanged) {
    return { direction, arrowCount: 1 };
  }

  const alignedWithVerdict =
    direction === 'progress'
      ? current.weightKg > prev.weightKg && current.reps > prev.reps
      : current.weightKg < prev.weightKg && current.reps < prev.reps;

  return { direction, arrowCount: alignedWithVerdict ? 3 : 2 };
}

/**
 * Short chip label for a comparison: the arrow count doubles as the magnitude,
 * so "3" reads as "weight and reps both moved the same way".
 */
export function formatSetDeltaLabel(result: NonNullable<SetComparisonResult>): string {
  return String(result.arrowCount);
}

export function buildSetComparisonAccessibilityLabel(
  setNumber: number,
  prev: LoggedSet,
  current: LoggedSet,
  result: NonNullable<SetComparisonResult>,
): string {
  const verdict = result.direction === 'progress' ? 'progress' : 'decline';
  const weightPart =
    current.weightKg > prev.weightKg
      ? 'weight up'
      : current.weightKg < prev.weightKg
        ? 'weight down'
        : 'weight same';
  const repsPart =
    current.reps > prev.reps ? 'reps up' : current.reps < prev.reps ? 'reps down' : 'reps same';
  return `Set ${setNumber} ${verdict}: ${weightPart}, ${repsPart}`;
}
