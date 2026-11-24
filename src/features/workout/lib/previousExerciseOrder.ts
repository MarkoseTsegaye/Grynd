import { sortExercisesByPerformedOrder } from './sortExercisesByPerformedOrder';
import type { LoggedExercise, WorkoutSession } from '../types';

export interface PreviousExerciseOrder {
  /** Planned exercise id → 1-based position it was performed in last time. */
  positionById: Map<string, number>;
  /** Planned exercise ids in last session's performed order. */
  orderedIds: string[];
}

const EMPTY: PreviousExerciseOrder = { positionById: new Map(), orderedIds: [] };

/**
 * A substitute is logged under its own id but stands in for the planned
 * exercise, so both sides of the comparison key off the planned one — the
 * same resolution `getPreviousPerformance` and `getPriorExerciseSets` use.
 */
export function plannedIdOf(exercise: LoggedExercise): string {
  return exercise.substitutedForExerciseId ?? exercise.exerciseId;
}

/**
 * Where each exercise sat in the previous run of this split.
 *
 * Exercises with no logged sets are skipped: one you walked past last week
 * never had a position, and ghosting a position you didn't occupy would be a
 * lie dressed as data.
 */
export function buildPreviousExerciseOrder(
  previous: WorkoutSession | null,
): PreviousExerciseOrder {
  if (!previous) return EMPTY;

  const performed = sortExercisesByPerformedOrder(previous.exercises).filter(
    (exercise) => exercise.sets.length > 0,
  );

  const positionById = new Map<string, number>();
  const orderedIds: string[] = [];

  performed.forEach((exercise) => {
    const id = plannedIdOf(exercise);
    if (positionById.has(id)) return;
    orderedIds.push(id);
    positionById.set(id, orderedIds.length);
  });

  return { positionById, orderedIds };
}

/**
 * This session's exercises rearranged into last session's order.
 *
 * Anything that wasn't performed last week keeps its current relative order
 * and follows behind — it has no position to sort by, and dropping or
 * scattering it would lose work the user has already planned.
 */
export function applyPreviousOrder(
  current: LoggedExercise[],
  orderedIds: string[],
): LoggedExercise[] {
  if (orderedIds.length === 0) return current;

  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  const known: { exercise: LoggedExercise; rank: number; index: number }[] = [];
  const rest: LoggedExercise[] = [];

  current.forEach((exercise, index) => {
    const position = rank.get(plannedIdOf(exercise));
    if (position === undefined) rest.push(exercise);
    else known.push({ exercise, rank: position, index });
  });

  known.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index));

  return [...known.map((entry) => entry.exercise), ...rest];
}

/** True when the session is already in last session's order. */
export function matchesPreviousOrder(
  current: LoggedExercise[],
  orderedIds: string[],
): boolean {
  const reordered = applyPreviousOrder(current, orderedIds);
  return reordered.every((exercise, index) => exercise === current[index]);
}
