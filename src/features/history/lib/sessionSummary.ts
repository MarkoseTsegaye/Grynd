import { kgToLbs } from '../../../shared/lib/weight';
import { formatVolumeAbbreviated, getSessionVolume } from '../../progress/lib/sessionVolume';
import type { WorkoutSession } from '../../workout/types';

/**
 * Beyond this a "session" is almost certainly a timer someone forgot to stop,
 * not a real workout, so we show no duration rather than a misleading one.
 */
const MAX_PLAUSIBLE_SESSION_MS = 12 * 60 * 60 * 1000;

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getSessionSetCount(session: WorkoutSession): number {
  return session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

/** Sessions with no logged sets shouldn't advertise themselves as workouts. */
export function isEmptySession(session: WorkoutSession): boolean {
  return getSessionSetCount(session) === 0;
}

export function formatDuration(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_PLAUSIBLE_SESSION_MS) return null;

  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatSessionDuration(session: WorkoutSession): string | null {
  if (session.completedAt === null || session.completedAt === undefined) return null;
  return formatDuration(session.completedAt - session.startedAt);
}

/** Volume is stored in kg·reps; convert once for display so lbs users see lb·reps. */
export function getSessionVolumeInUnit(session: WorkoutSession, unit: 'kg' | 'lbs'): number {
  const volumeKg = getSessionVolume(session);
  return unit === 'lbs' ? kgToLbs(volumeKg) : volumeKg;
}

export interface SessionSummary {
  setCount: number;
  setCountText: string;
  exerciseCount: number;
  volumeText: string;
  volumeLabel: string;
  durationText: string | null;
}

export function getSessionSummary(
  session: WorkoutSession,
  unit: 'kg' | 'lbs',
): SessionSummary {
  const setCount = getSessionSetCount(session);
  return {
    setCount,
    setCountText: pluralize(setCount, 'set'),
    exerciseCount: session.exercises.length,
    volumeText: formatVolumeAbbreviated(getSessionVolumeInUnit(session, unit)),
    volumeLabel: unit === 'lbs' ? 'lb·reps' : 'kg·reps',
    durationText: formatSessionDuration(session),
  };
}

/** Distinct split names across history, newest session first, for filter chips. */
export function getSplitFilters(sessions: WorkoutSession[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const session of sessions) {
    const name = session.splitName?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function filterSessionsBySplit(
  sessions: WorkoutSession[],
  splitName: string | null,
): WorkoutSession[] {
  if (!splitName) return sessions;
  return sessions.filter((session) => session.splitName === splitName);
}
