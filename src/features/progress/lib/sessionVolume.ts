import { formatShortDate } from '../../../shared/lib/date';
import type { WorkoutSession } from '../../workout/types';

export type VolumePoint = {
  date: number;
  volume: number;
  label: string;
};

export type VolumeTrendDirection = 'progress' | 'decline' | 'neutral';

export type VolumeTrend = {
  direction: VolumeTrendDirection;
  deltaPercent: number | null;
  current: number;
  previous: number;
};

export function getSessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.reduce((setTotal, set) => setTotal + set.weightKg * set.reps, 0),
    0,
  );
}

export function buildVolumeSeries(sessions: WorkoutSession[]): VolumePoint[] {
  return sessions
    .map((session) => ({ session, volume: getSessionVolume(session) }))
    .filter(({ volume }) => volume > 0)
    .sort((a, b) => (a.session.completedAt ?? 0) - (b.session.completedAt ?? 0))
    .map(({ session, volume }) => {
      const date = session.completedAt ?? session.startedAt;
      return { date, volume, label: formatShortDate(date) };
    });
}

export function getLatestVolumeTrend(series: VolumePoint[]): VolumeTrend | null {
  if (series.length < 2) return null;

  const current = series[series.length - 1].volume;
  const previous = series[series.length - 2].volume;

  if (current === previous) {
    return { direction: 'neutral', deltaPercent: 0, current, previous };
  }

  const direction: VolumeTrendDirection = current > previous ? 'progress' : 'decline';
  const deltaPercent =
    previous === 0 ? null : Math.round((Math.abs(current - previous) / previous) * 100);

  return { direction, deltaPercent, current, previous };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Volume over a trailing window, for the "recent work" figure on the volume
 * card. Rolling days rather than a calendar week: a Monday-reset number reads
 * as a collapse every Monday morning, which is not what the card is for.
 */
export function getVolumeInLastDays(
  sessions: WorkoutSession[],
  days = 7,
  now: number = Date.now(),
): number {
  const since = now - days * MS_PER_DAY;

  return sessions.reduce((total, session) => {
    const completedAt = session.completedAt;
    if (completedAt === null || completedAt === undefined) return total;
    if (completedAt < since || completedAt > now) return total;
    return total + getSessionVolume(session);
  }, 0);
}

export function formatVolumeAbbreviated(volume: number): string {
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}k`;
  return String(Math.round(volume));
}
