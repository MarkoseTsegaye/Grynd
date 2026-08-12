import type { CycleDay, Split } from '../types';

export type CycleDayState = 'done' | 'today' | 'upcoming';

export interface CycleStripDay {
  key: string;
  /** 1-based position in the cycle. */
  dayNumber: number;
  state: CycleDayState;
  isRest: boolean;
  /** Split name, or "Rest". Already shortened for a narrow pill. */
  label: string;
}

const MAX_LABEL_LENGTH = 7;

function shortenLabel(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= MAX_LABEL_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}

/**
 * The whole cycle as pills, so "Day 5 of 8" is something you can see rather
 * than only read. Days before the current one read as done, the current one is
 * highlighted, the rest are upcoming.
 *
 * `maxDays` caps very long cycles by windowing around today, keeping the strip
 * on one row instead of letting it scroll off.
 */
export function buildCycleStrip(
  days: CycleDay[],
  currentIndex: number,
  splits: Split[],
  maxDays = 8,
): CycleStripDay[] {
  if (days.length === 0) return [];

  const safeIndex = ((currentIndex % days.length) + days.length) % days.length;

  let start = 0;
  if (days.length > maxDays) {
    // Keep today roughly centred, without running past either end.
    start = Math.max(0, Math.min(safeIndex - Math.floor(maxDays / 2), days.length - maxDays));
  }
  const end = Math.min(start + maxDays, days.length);

  const window: CycleStripDay[] = [];
  for (let index = start; index < end; index++) {
    const day = days[index];
    const isRest = day.type === 'rest';
    const split = isRest ? null : splits.find((s) => s.id === day.splitId) ?? null;

    window.push({
      key: `${index}-${day.id}`,
      dayNumber: index + 1,
      state: index === safeIndex ? 'today' : index < safeIndex ? 'done' : 'upcoming',
      isRest,
      label: isRest ? 'Rest' : shortenLabel(split?.name ?? 'Split'),
    });
  }

  return window;
}
