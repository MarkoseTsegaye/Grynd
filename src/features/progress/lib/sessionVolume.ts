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
    .filter((session) => getSessionVolume(session) > 0)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
    .map((session) => ({
      date: session.completedAt ?? session.startedAt,
      volume: getSessionVolume(session),
      label: formatShortDate(session.completedAt ?? session.startedAt),
    }));
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

export function formatVolumeAbbreviated(volume: number): string {
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}k`;
  return String(Math.round(volume));
}
