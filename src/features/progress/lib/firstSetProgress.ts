import { formatShortDate } from '../../../shared/lib/date';
import type { LoggedExercise, WorkoutSession } from '../../workout/types';

export type FirstSetPoint = {
  date: number;
  label: string;
  sessionId: string;
  weightKg: number;
  reps: number;
  exerciseName: string;
};

export type FirstSetTrendKind =
  | 'weight_up'
  | 'weight_down'
  | 'reps_up'
  | 'reps_down'
  | 'neutral';

export type FirstSetTrend = {
  kind: FirstSetTrendKind;
  current: FirstSetPoint;
  previous: FirstSetPoint;
  deltaWeightKg: number;
  deltaReps: number;
};

export type ProgressRangeId = '1m' | '2m' | '6m' | 'all';

export const PROGRESS_RANGE_OPTIONS: { id: ProgressRangeId; label: string; months: number | null }[] =
  [
    { id: '1m', label: '1 mo', months: 1 },
    { id: '2m', label: '2 mo', months: 2 },
    { id: '6m', label: '6 mo', months: 6 },
    { id: 'all', label: 'All', months: null },
  ];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function rangeStartMs(
  rangeId: ProgressRangeId,
  now: number = Date.now(),
): number | null {
  const option = PROGRESS_RANGE_OPTIONS.find((o) => o.id === rangeId);
  if (!option || option.months === null) return null;
  // Approximate calendar months as 30-day windows for stable filtering.
  return now - option.months * 30 * MS_PER_DAY;
}

export function matchesPlannedExercise(
  logged: LoggedExercise,
  exerciseId: string,
): boolean {
  return (
    logged.exerciseId === exerciseId || logged.substitutedForExerciseId === exerciseId
  );
}

export function buildFirstSetSeries(
  sessions: WorkoutSession[],
  exerciseId: string,
  rangeId: ProgressRangeId = '2m',
  now: number = Date.now(),
): FirstSetPoint[] {
  const start = rangeStartMs(rangeId, now);

  return sessions
    .filter((session) => session.completedAt !== null)
    .filter((session) => start === null || (session.completedAt ?? 0) >= start)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
    .flatMap((session) => {
      const exercise = session.exercises.find(
        (e) => matchesPlannedExercise(e, exerciseId) && e.sets.length > 0,
      );
      if (!exercise) return [];

      const first = exercise.sets[0];
      const date = session.completedAt ?? session.startedAt;
      return [
        {
          date,
          label: formatShortDate(date),
          sessionId: session.id,
          weightKg: first.weightKg,
          reps: first.reps,
          exerciseName: exercise.exerciseName,
        },
      ];
    });
}

export interface RangeAvailability {
  id: ProgressRangeId;
  label: string;
  count: number;
  hasData: boolean;
}

/** How many sessions each range would show, so empty ranges can be subdued. */
export function getRangeAvailability(
  sessions: WorkoutSession[],
  exerciseId: string,
  now: number = Date.now(),
): RangeAvailability[] {
  return PROGRESS_RANGE_OPTIONS.map((option) => {
    const count = buildFirstSetSeries(sessions, exerciseId, option.id, now).length;
    return { id: option.id, label: option.label, count, hasData: count > 0 };
  });
}

/**
 * Smallest range that actually shows a trend, so the chart doesn't open on an
 * empty or single-point window. Falls back to the widest range with any data,
 * then to the default.
 */
export function pickDefaultRange(
  availability: RangeAvailability[],
  minPoints = 3,
): ProgressRangeId {
  const meaningful = availability.find((range) => range.count >= minPoints);
  if (meaningful) return meaningful.id;

  const withData = [...availability].reverse().find((range) => range.hasData);
  return withData?.id ?? 'all';
}

export function getFirstSetTrend(points: FirstSetPoint[]): FirstSetTrend | null {
  if (points.length < 2) return null;

  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  const deltaWeightKg = current.weightKg - previous.weightKg;
  const deltaReps = current.reps - previous.reps;

  if (deltaWeightKg > 0) {
    return { kind: 'weight_up', current, previous, deltaWeightKg, deltaReps };
  }
  if (deltaWeightKg < 0) {
    return { kind: 'weight_down', current, previous, deltaWeightKg, deltaReps };
  }
  if (deltaReps > 0) {
    return { kind: 'reps_up', current, previous, deltaWeightKg, deltaReps };
  }
  if (deltaReps < 0) {
    return { kind: 'reps_down', current, previous, deltaWeightKg, deltaReps };
  }
  return { kind: 'neutral', current, previous, deltaWeightKg, deltaReps };
}

/** Latest point is a personal best if it beats all earlier points on weight, then reps. */
export function isPersonalBest(points: FirstSetPoint[]): boolean {
  if (points.length === 0) return false;
  const latest = points[points.length - 1];
  return points.slice(0, -1).every((point) => {
    if (latest.weightKg > point.weightKg) return true;
    if (latest.weightKg < point.weightKg) return false;
    return latest.reps >= point.reps;
  }) && points.length > 1;
}
