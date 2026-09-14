import type { ComponentProps } from 'react';
import type { Icon } from '../../../shared/components/Icon';
import { getSplitGlyph } from './splitGlyph';
import type { CycleDay, Split } from '../types';

type IconName = ComponentProps<typeof Icon>['name'];

export type CycleDayState = 'done' | 'today' | 'upcoming';

/** Rest days are a moon rather than a split glyph. */
export const REST_GLYPH: IconName = 'sleep';

export interface CycleStripDay {
  key: string;
  /** 1-based position in the cycle. */
  dayNumber: number;
  /** 0-based index into `days`, for `setCurrentIndex`. */
  index: number;
  state: CycleDayState;
  isRest: boolean;
  /** Split name, or "Rest". The pill shows a glyph; this is the a11y label. */
  label: string;
  glyph: IconName;
}

/**
 * The whole cycle as pills, so "Day 5 of 8" is something you can see rather
 * than only read. Days before the current one read as done, the current one is
 * highlighted, the rest are upcoming.
 *
 * Returns **every** day: the strip scrolls now, so windowing it around today
 * only hid the ends. `maxDays` remains for tests that want a bounded slice.
 */
export function buildCycleStrip(
  days: CycleDay[],
  currentIndex: number,
  splits: Split[],
  maxDays = Infinity,
): CycleStripDay[] {
  if (days.length === 0) return [];

  const safeIndex = ((currentIndex % days.length) + days.length) % days.length;

  let start = 0;
  if (days.length > maxDays) {
    // Keep today roughly centred, without running past either end.
    start = Math.max(0, Math.min(safeIndex - Math.floor(maxDays / 2), days.length - maxDays));
  }
  const end = Math.min(start + maxDays, days.length);

  const strip: CycleStripDay[] = [];
  for (let index = start; index < end; index++) {
    const day = days[index];
    const isRest = day.type === 'rest';
    const split = isRest ? null : splits.find((s) => s.id === day.splitId) ?? null;

    strip.push({
      key: `${index}-${day.id}`,
      dayNumber: index + 1,
      index,
      state: index === safeIndex ? 'today' : index < safeIndex ? 'done' : 'upcoming',
      isRest,
      label: isRest ? 'Rest' : split?.name ?? 'Split',
      glyph: isRest ? REST_GLYPH : getSplitGlyph(split?.name ?? ''),
    });
  }

  return strip;
}
