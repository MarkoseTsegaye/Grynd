import { describe, expect, it } from 'vitest';
import {
  dateToCompletedAtMs,
  formatDisplayDate,
  isFutureCalendarDay,
} from '../date';

function localDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function endOfLocalDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

describe('formatDisplayDate', () => {
  it('formats a date with month, day, and year', () => {
    const formatted = formatDisplayDate(localDate(2026, 6, 28));
    expect(formatted).toBe('Jun 28, 2026');
  });
});

describe('isFutureCalendarDay', () => {
  it('returns true for a day after the reference date', () => {
    const reference = localDate(2026, 6, 28);
    const future = localDate(2026, 6, 29);
    expect(isFutureCalendarDay(future, reference)).toBe(true);
  });

  it('returns false for today and past days', () => {
    const reference = localDate(2026, 6, 28);
    expect(isFutureCalendarDay(reference, reference)).toBe(false);
    expect(isFutureCalendarDay(localDate(2026, 6, 27), reference)).toBe(false);
  });
});

describe('dateToCompletedAtMs', () => {
  it('uses end of the selected local day when selected is not today', () => {
    const startedAt = localDate(2026, 6, 28, 9).getTime();
    const selected = localDate(2026, 6, 28);
    const now = localDate(2026, 6, 29, 12).getTime();
    expect(dateToCompletedAtMs(selected, startedAt, now)).toBe(endOfLocalDay(selected));
  });

  it('uses wall-clock now when selected day is today', () => {
    const startedAt = localDate(2026, 6, 28, 9).getTime();
    const selected = localDate(2026, 6, 28, 10);
    const now = localDate(2026, 6, 28, 15).getTime();
    expect(dateToCompletedAtMs(selected, startedAt, now)).toBe(now);
  });

  it('clamps to startedAt when the selected day is before the workout start day', () => {
    const startedAt = localDate(2026, 6, 28, 15).getTime();
    const selected = localDate(2026, 6, 27);
    expect(dateToCompletedAtMs(selected, startedAt)).toBe(startedAt);
  });

  it('returns end of selected day when startedAt is earlier on the same day and day is not today', () => {
    const startedAt = localDate(2026, 6, 28, 22).getTime();
    const selected = localDate(2026, 6, 28);
    const now = localDate(2026, 6, 29, 12).getTime();
    expect(dateToCompletedAtMs(selected, startedAt, now)).toBe(endOfLocalDay(selected));
  });

  it('clamps to startedAt when startedAt is after end of selected day', () => {
    const selected = localDate(2026, 6, 28);
    const startedAt = endOfLocalDay(selected) + 500;
    const now = localDate(2026, 6, 29, 12).getTime();
    expect(dateToCompletedAtMs(selected, startedAt, now)).toBe(startedAt);
  });
});
