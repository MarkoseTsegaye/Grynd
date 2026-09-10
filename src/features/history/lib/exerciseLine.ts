import { formatWeight, unitLabel, weightKgToDisplay } from '../../../shared/lib/weight';
import type { LoggedExercise, LoggedSet } from '../../workout/types';

type WeightUnit = 'kg' | 'lbs';

export type ExerciseLineDirection = 'up' | 'down' | 'flat';

export interface ExerciseLineDelta {
  direction: ExerciseLineDirection;
  /** `"+5 lb"`, `"−1 rep"`, or `"same"`. */
  label: string;
}

export interface ExerciseLine {
  /** `"4×8"`, `"4×6–10"`, `"4×8 L/R"`. */
  setsText: string;
  /** `"225 lb"` or `"BW"` for an unloaded set. */
  topSetText: string;
  /** null when the exercise has no prior session to compare against. */
  delta: ExerciseLineDelta | null;
}

const MINUS = '−';
const EN_DASH = '–';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatMagnitude(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/**
 * The set that represents the exercise on a one-line summary: heaviest
 * load, and among equal loads the one that got the most reps.
 */
export function pickTopSet(sets: LoggedSet[]): LoggedSet | null {
  let top: LoggedSet | null = null;
  for (const set of sets) {
    if (
      top === null ||
      set.weightKg > top.weightKg ||
      (set.weightKg === top.weightKg && set.reps > top.reps)
    ) {
      top = set;
    }
  }
  return top;
}

/**
 * Unilateral work logs left and right as separate sets, so a raw count
 * reads "8" for four pairs. Keyed off the sides actually recorded rather
 * than `exercise.unilateral`: the flag can be set on an exercise whose
 * sets were logged without sides, and sided sets can arrive without it.
 */
function describeSetCount(sets: LoggedSet[]): { count: number; suffix: string } {
  const sided = sets.filter((set) => set.side !== undefined);
  if (sided.length === 0) return { count: sets.length, suffix: '' };

  const left = sided.filter((set) => set.side === 'left').length;
  const right = sided.length - left;
  return { count: Math.max(left, right) + (sets.length - sided.length), suffix: ' L/R' };
}

function describeReps(sets: LoggedSet[]): string {
  let min = sets[0].reps;
  let max = sets[0].reps;
  for (const set of sets) {
    if (set.reps < min) min = set.reps;
    if (set.reps > max) max = set.reps;
  }
  return min === max ? `${min}` : `${min}${EN_DASH}${max}`;
}

function describeTopSet(set: LoggedSet, unit: WeightUnit): string {
  // Bodyweight movements log 0 kg; "0 lb" reads like a data-entry mistake.
  if (set.weightKg === 0) return 'BW';
  return `${formatWeight(set.weightKg, unit)} ${unitLabel(unit)}`;
}

/**
 * Weight beats reps: a lifter who added load and dropped a rep has moved
 * up, and showing both changes on one chip is noise at this size.
 *
 * The weight delta is the difference between the two *displayed* numbers,
 * not the converted difference of the stored kilograms, so the chip always
 * agrees with the arithmetic a user can do from the two session cards.
 */
function compareTopSets(
  current: LoggedSet,
  prior: LoggedSet,
  unit: WeightUnit,
): ExerciseLineDelta {
  const weightDelta = round1(
    weightKgToDisplay(current.weightKg, unit) - weightKgToDisplay(prior.weightKg, unit),
  );
  if (weightDelta !== 0) {
    const magnitude = formatMagnitude(Math.abs(weightDelta));
    return {
      direction: weightDelta > 0 ? 'up' : 'down',
      label: `${weightDelta > 0 ? '+' : MINUS}${magnitude} ${unitLabel(unit)}`,
    };
  }

  const repsDelta = current.reps - prior.reps;
  if (repsDelta !== 0) {
    const magnitude = Math.abs(repsDelta);
    return {
      direction: repsDelta > 0 ? 'up' : 'down',
      label: `${repsDelta > 0 ? '+' : MINUS}${magnitude} ${magnitude === 1 ? 'rep' : 'reps'}`,
    };
  }

  return { direction: 'flat', label: 'same' };
}

/**
 * Collapses one logged exercise to the single line a history card shows:
 * `Squat  4×8 @ 225 lb  +5 lb`. Returns null when nothing was logged, so
 * the card can skip the row entirely.
 */
export function summarizeExerciseLine(
  exercise: LoggedExercise,
  priorSets: LoggedSet[] | null,
  unit: WeightUnit,
): ExerciseLine | null {
  const sets = exercise.sets;
  if (sets.length === 0) return null;

  const topSet = pickTopSet(sets);
  if (topSet === null) return null;

  const { count, suffix } = describeSetCount(sets);
  const priorTop = priorSets && priorSets.length > 0 ? pickTopSet(priorSets) : null;

  return {
    setsText: `${count}×${describeReps(sets)}${suffix}`,
    topSetText: describeTopSet(topSet, unit),
    delta: priorTop === null ? null : compareTopSets(topSet, priorTop, unit),
  };
}
