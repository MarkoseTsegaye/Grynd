import { formatShortDate } from '../../../shared/lib/date';
import type { WorkoutSession } from '../../workout/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Most recent completed session for a split, or null if never performed. */
export function getLastPerformedAt(
  sessions: WorkoutSession[],
  splitId: string,
): number | null {
  let latest: number | null = null;

  for (const session of sessions) {
    if (session.splitId !== splitId) continue;
    if (session.completedAt === null || session.completedAt === undefined) continue;
    if (latest === null || session.completedAt > latest) latest = session.completedAt;
  }

  return latest;
}

/** Whole days between two instants, counted by calendar day rather than by 24h blocks. */
export function daysBetween(from: number, to: number): number {
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}

/**
 * "Today" / "Yesterday" / "3 days ago" for the recent past, falling back to a
 * date once the day count stops being useful. Future timestamps (clock skew,
 * an edited completion date) read as Today rather than "-2 days ago".
 */
export function formatRelativeDay(timestamp: number, now: number = Date.now()): string {
  const days = daysBetween(timestamp, now);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return formatShortDate(timestamp);
}

export interface SplitActivity {
  lastPerformedAt: number | null;
  label: string | null;
}

export function getSplitActivity(
  sessions: WorkoutSession[],
  splitId: string,
  now: number = Date.now(),
): SplitActivity {
  const lastPerformedAt = getLastPerformedAt(sessions, splitId);
  return {
    lastPerformedAt,
    label: lastPerformedAt === null ? null : formatRelativeDay(lastPerformedAt, now),
  };
}
