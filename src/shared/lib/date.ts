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

/**
 * `YYYY-MM-DD` in the local calendar. Stable per-day bucket key for
 * once-a-day records (body weight, calorie intake) where two entries on the
 * same wall-clock day should collapse to one, regardless of the exact
 * timestamp they were logged at.
 */
export function toDateKey(input: Date | number): string {
  const d = typeof input === 'number' ? new Date(input) : input;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateKeyToday(now: Date | number = Date.now()): string {
  return toDateKey(now);
}

/**
 * Parse a `YYYY-MM-DD` key back to a Date at local midnight. Returns null
 * for malformed input rather than throwing so callers can guard cheaply.
 */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  // Reject overflow like 2026-02-31 (Date silently rolls into March otherwise).
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
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
