import { describe, expect, it } from 'vitest';
import { buildCycleStrip } from '../lib/cycleStrip';
import type { CycleDay, Split } from '../types';

const splits: Split[] = [
  { id: 'push', name: 'Push', exerciseIds: [], createdAt: 1 },
  { id: 'legs', name: 'Legs Day Extra Long', exerciseIds: [], createdAt: 2 },
];

function day(id: string, splitId?: string): CycleDay {
  return splitId ? { id, type: 'split', splitId } : { id, type: 'rest' };
}

const cycle: CycleDay[] = [
  day('d1', 'push'),
  day('d2', 'legs'),
  day('d3'),
  day('d4', 'push'),
];

describe('buildCycleStrip', () => {
  it('marks past, current and future days', () => {
    const strip = buildCycleStrip(cycle, 2, splits);
    expect(strip.map((d) => d.state)).toEqual(['done', 'done', 'today', 'upcoming']);
  });

  it('numbers days from one', () => {
    expect(buildCycleStrip(cycle, 0, splits).map((d) => d.dayNumber)).toEqual([1, 2, 3, 4]);
  });

  it('labels rest days and names split days', () => {
    const strip = buildCycleStrip(cycle, 0, splits);
    expect(strip[0].label).toBe('Push');
    expect(strip[2].label).toBe('Rest');
    expect(strip[2].isRest).toBe(true);
  });

  it('shortens a long split name to fit the pill', () => {
    const strip = buildCycleStrip(cycle, 0, splits);
    expect(strip[1].label).toBe('Legs D…');
    expect(strip[1].label.length).toBeLessThanOrEqual(7);
  });

  it('falls back when a day points at a deleted split', () => {
    const strip = buildCycleStrip([day('d1', 'gone')], 0, splits);
    expect(strip[0].label).toBe('Split');
  });

  it('returns nothing for an empty cycle', () => {
    expect(buildCycleStrip([], 0, splits)).toEqual([]);
  });

  it('wraps an out-of-range index instead of losing today', () => {
    const strip = buildCycleStrip(cycle, 6, splits);
    expect(strip.filter((d) => d.state === 'today')).toHaveLength(1);
    expect(strip[2].state).toBe('today');
  });

  it('handles a negative index', () => {
    const strip = buildCycleStrip(cycle, -1, splits);
    expect(strip[3].state).toBe('today');
  });

  describe('long cycles', () => {
    const long: CycleDay[] = Array.from({ length: 14 }, (_, i) => day(`d${i}`, 'push'));

    it('caps the strip at maxDays', () => {
      expect(buildCycleStrip(long, 0, splits, 8)).toHaveLength(8);
    });

    it('always includes today', () => {
      for (const index of [0, 5, 9, 13]) {
        const strip = buildCycleStrip(long, index, splits, 8);
        expect(strip.filter((d) => d.state === 'today')).toHaveLength(1);
      }
    });

    it('windows around today rather than always starting at day one', () => {
      const strip = buildCycleStrip(long, 10, splits, 8);
      expect(strip[0].dayNumber).toBeGreaterThan(1);
      expect(strip.map((d) => d.dayNumber)).toContain(11);
    });

    it('does not run past the end of the cycle', () => {
      const strip = buildCycleStrip(long, 13, splits, 8);
      expect(strip[strip.length - 1].dayNumber).toBe(14);
      expect(strip).toHaveLength(8);
    });
  });
});
