import type { CycleDay } from '../types';

export interface CycleUsage {
  /** 1-based cycle day numbers that run this split, in order. */
  days: number[];
  inCycle: boolean;
  /** "day 5" / "days 1, 4" / null when the split is not scheduled. */
  label: string | null;
}

/**
 * Which cycle days run a given split.
 *
 * Without this a split that is missing from the cycle simply never appears on
 * Home, with nothing anywhere explaining why — the list looks identical to a
 * scheduled one.
 */
export function getCycleUsage(days: CycleDay[], splitId: string): CycleUsage {
  const matched: number[] = [];

  days.forEach((day, index) => {
    if (day.type === 'split' && day.splitId === splitId) {
      matched.push(index + 1);
    }
  });

  return {
    days: matched,
    inCycle: matched.length > 0,
    label: formatCycleDays(matched),
  };
}

export function formatCycleDays(days: number[]): string | null {
  if (days.length === 0) return null;
  if (days.length === 1) return `day ${days[0]}`;
  // Beyond a few, listing every day stops being readable in a list row.
  if (days.length > 3) return `${days.length} days`;
  return `days ${days.join(', ')}`;
}
