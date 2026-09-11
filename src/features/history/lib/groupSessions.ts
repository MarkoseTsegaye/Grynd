import { startOfWeek } from '../../../shared/lib/date';
import type { WorkoutSession } from '../../workout/types';

export interface SessionSection {
  title: string;
  data: WorkoutSession[];
}

/** The timestamp History orders and buckets by: when the workout landed. */
export function getSessionDate(session: WorkoutSession): number {
  return session.completedAt ?? session.startedAt;
}

function monthTitle(timestampMs: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(timestampMs),
  );
}

/**
 * Buckets sessions into "This week" / "Last week" / "September 2026" so a
 * month of history reads as a log instead of an undifferentiated stack.
 *
 * Sorts explicitly rather than trusting the store: `historyStore` keeps
 * whatever order the storage adapter returned.
 *
 * Empty sessions are deliberately kept — History's swipe row is the only way
 * to delete one, so filtering them here would make them unreachable.
 */
export function groupSessionsByPeriod(
  sessions: WorkoutSession[],
  now: number = Date.now(),
): SessionSection[] {
  const thisWeekStart = startOfWeek(now).getTime();
  const lastWeekStart = startOfWeek(thisWeekStart - 1).getTime();

  const sorted = [...sessions].sort((a, b) => getSessionDate(b) - getSessionDate(a));

  const sections: SessionSection[] = [];
  // Sessions arrive newest-first, so a bucket is only ever appended to while
  // it is the last section — no map/re-sort pass needed.
  let currentTitle: string | null = null;

  for (const session of sorted) {
    const at = getSessionDate(session);
    let title: string;
    if (at >= thisWeekStart) {
      title = 'This week';
    } else if (at >= lastWeekStart) {
      title = 'Last week';
    } else {
      title = monthTitle(at);
    }

    if (title !== currentTitle) {
      sections.push({ title, data: [] });
      currentTitle = title;
    }
    sections[sections.length - 1].data.push(session);
  }

  return sections;
}
