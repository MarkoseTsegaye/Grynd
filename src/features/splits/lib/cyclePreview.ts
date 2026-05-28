import type { CycleDay, Split } from '../types';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface UpcomingCycleDay {
  day: CycleDay;
  split: Split | null;
  label: string;
  idx: number;
}

function getUpcomingLabel(offsetDays: number): string {
  if (offsetDays === 1) return 'Tomorrow';
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return WEEKDAY_LABELS[date.getDay()];
}

/**
 * Returns upcoming cycle days starting tomorrow through the next rest day (inclusive).
 * If the cycle contains no rest days, returns an empty array (upcoming row hidden).
 */
export function getUpcomingDaysThroughNextRest(
  days: CycleDay[],
  currentIndex: number,
  splits: Split[],
): UpcomingCycleDay[] {
  if (days.length === 0) return [];

  const result: UpcomingCycleDay[] = [];
  let foundRest = false;

  for (let offset = 1; offset <= days.length; offset++) {
    const idx = (currentIndex + offset) % days.length;
    const day = days[idx];
    const split = day.type === 'split'
      ? splits.find((s) => s.id === day.splitId) ?? null
      : null;

    result.push({ day, split, label: getUpcomingLabel(offset), idx });

    if (day.type === 'rest') {
      foundRest = true;
      break;
    }
  }

  return foundRest ? result : [];
}
