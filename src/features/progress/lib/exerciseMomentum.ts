import type { Exercise } from '../../splits/types';
import type { WorkoutSession } from '../../workout/types';
import { isEmptySession } from '../../history/lib/sessionSummary';
import { buildFirstSetSeries, isPersonalBest } from './firstSetProgress';
import { getMetricValue } from './chartMetric';
import { getSeriesTrend, type SeriesTrend } from './sparkline';

/**
 * Ranks the exercise catalog by how it's actually moving, so the Trends
 * tab can lead with the lifts worth looking at instead of an
 * alphabetical list that gives no reason to tap any particular row.
 *
 * Estimated 1RM is the series, not raw weight: a set that went 8 reps →
 * 10 reps at the same load is real progress, and plotting weight alone
 * renders it as a flat line.
 */

export interface MomentumRow {
  exerciseId: string;
  name: string;
  /** Est. 1RM per session, oldest first — feeds Sparkline. */
  values: number[];
  trend: SeriesTrend | null;
  /** ms of the most recent session containing this exercise. */
  lastLoggedAt: number | null;
  isPr: boolean;
}

export interface ExerciseMomentum {
  rising: MomentumRow[];
  stalled: MomentumRow[];
  prs: MomentumRow[];
}

/** Sessions needed before a series says anything about direction. */
const MIN_SESSIONS = 3;
/** A lift not touched in this long isn't "stalled", it's abandoned. */
const STALLED_RECENCY_MS = 60 * 24 * 60 * 60 * 1000;
/** How recent a personal best has to be to still be news. */
const PR_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Past this, a bucket stops being a shortlist. */
const MAX_PER_BUCKET = 5;

export function rankExerciseMomentum(input: {
  exercises: Exercise[];
  sessions: WorkoutSession[];
  now?: number;
}): ExerciseMomentum {
  const now = input.now ?? Date.now();
  // A session with no logged sets shouldn't move anything.
  const sessions = input.sessions.filter((s) => !isEmptySession(s));

  const rows: MomentumRow[] = input.exercises.map((exercise) => {
    // Substitutions already collapse onto the planned exercise id inside
    // buildFirstSetSeries, so a substituted-in lift doesn't fork the series.
    const points = buildFirstSetSeries(sessions, exercise.id, 'all', now);
    const values = points.map((point) => getMetricValue(point, 'e1rm'));

    return {
      exerciseId: exercise.id,
      name: exercise.name,
      values,
      trend: getSeriesTrend(values),
      lastLoggedAt: points.length > 0 ? points[points.length - 1].date : null,
      // isPersonalBest already returns false for a single-session series.
      isPr:
        isPersonalBest(points) &&
        points[points.length - 1].date >= now - PR_WINDOW_MS,
    };
  });

  const byMagnitude = (a: MomentumRow, b: MomentumRow) =>
    Math.abs(b.trend?.percent ?? 0) - Math.abs(a.trend?.percent ?? 0);

  const rising = rows
    .filter((row) => row.values.length >= MIN_SESSIONS && row.trend?.direction === 'up')
    .sort(byMagnitude)
    .slice(0, MAX_PER_BUCKET);

  const stalled = rows
    .filter(
      (row) =>
        row.values.length >= MIN_SESSIONS &&
        (row.trend?.direction === 'flat' || row.trend?.direction === 'down') &&
        row.lastLoggedAt !== null &&
        row.lastLoggedAt >= now - STALLED_RECENCY_MS,
    )
    .sort(byMagnitude)
    .slice(0, MAX_PER_BUCKET);

  const prs = rows
    .filter((row) => row.isPr)
    .sort((a, b) => (b.lastLoggedAt ?? 0) - (a.lastLoggedAt ?? 0))
    .slice(0, MAX_PER_BUCKET);

  return { rising, stalled, prs };
}
