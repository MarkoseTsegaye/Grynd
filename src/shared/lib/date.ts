export function formatShortDate(timestampMs: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(timestampMs),
  );
}

export function formatDisplayDate(date: Date | number): string {
  const value = typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function getLocalCalendarParts(date: Date | number): { year: number; month: number; day: number } {
  const d = new Date(date);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function compareCalendarDays(
  a: Date | number,
  b: Date | number,
): -1 | 0 | 1 {
  const da = getLocalCalendarParts(a);
  const db = getLocalCalendarParts(b);
  if (da.year !== db.year) return da.year < db.year ? -1 : 1;
  if (da.month !== db.month) return da.month < db.month ? -1 : 1;
  if (da.day !== db.day) return da.day < db.day ? -1 : 1;
  return 0;
}

export function isFutureCalendarDay(selected: Date, reference: Date = new Date()): boolean {
  return compareCalendarDays(selected, reference) > 0;
}

export function isBeforeCalendarDay(selected: Date, reference: Date | number): boolean {
  return compareCalendarDays(selected, reference) < 0;
}

function endOfLocalDay(date: Date | number): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Converts a picker calendar day to completedAt ms.
 * Uses wall-clock time for "today" so two finishes on the same day stay ordered;
 * otherwise end-of-day in local timezone. Clamps to startedAt when the selected
 * day is before the workout start day or the computed time would precede startedAt.
 */
export function dateToCompletedAtMs(
  selected: Date,
  startedAt: number,
  now: number = Date.now(),
): number {
  if (isBeforeCalendarDay(selected, startedAt)) {
    return startedAt;
  }
  // Same calendar day as now → unique wall-clock completedAt (avoids end-of-day collisions).
  if (compareCalendarDays(selected, now) === 0) {
    return Math.max(now, startedAt);
  }
  const endOfSelected = endOfLocalDay(selected);
  return Math.max(endOfSelected, startedAt);
}
