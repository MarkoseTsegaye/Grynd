import { describe, expect, it } from 'vitest';
import { buildCycleStrip, REST_GLYPH } from '../lib/cycleStrip';
import type { CycleDay, Split } from '../types';

const splits: Split[] = [
  { id: 'push', name: 'Push', exerciseIds: [], createdAt: 1, updatedAt: 1 },
  { id: 'legs', name: 'Legs Day Extra Long', exerciseIds: [], createdAt: 2, updatedAt: 2 },
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

  it('numbers days from one and carries the 0-based index for setCurrentIndex', () => {
    const strip = buildCycleStrip(cycle, 0, splits);
    expect(strip.map((d) => d.dayNumber)).toEqual([1, 2, 3, 4]);
    expect(strip.map((d) => d.index)).toEqual([0, 1, 2, 3]);
  });

  it('labels rest days and names split days', () => {
    const strip = buildCycleStrip(cycle, 0, splits);
    expect(strip[0].label).toBe('Push');
    expect(strip[2].label).toBe('Rest');
    expect(strip[2].isRest).toBe(true);
  });

  it('keeps the full split name — the pill shows a glyph, the name is the a11y label', () => {
    expect(buildCycleStrip(cycle, 0, splits)[1].label).toBe('Legs Day Extra Long');
  });

  it('gives each day a glyph, moon for rest', () => {
    const strip = buildCycleStrip(cycle, 0, splits);
    expect(strip[0].glyph).toBe('arm-flex'); // "Push"
    expect(strip[1].glyph).toBe('human-handsdown'); // "Legs …"
    expect(strip[2].glyph).toBe(REST_GLYPH);
  });

  it('falls back when a day points at a deleted split', () => {
    const strip = buildCycleStrip([day('d1', 'gone')], 0, splits);
    expect(strip[0].label).toBe('Split');
    expect(strip[0].glyph).toBe('dumbbell');
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

    it('returns every day by default — the strip scrolls', () => {
      const strip = buildCycleStrip(long, 10, splits);
      expect(strip).toHaveLength(14);
      expect(strip[0].dayNumber).toBe(1);
      expect(strip[13].dayNumber).toBe(14);
    });

    it('still windows when a caller passes maxDays', () => {
      expect(buildCycleStrip(long, 0, splits, 8)).toHaveLength(8);
    });

    it('always includes today when windowed', () => {
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

    it('does not run past the end of the cycle when windowed', () => {
      const strip = buildCycleStrip(long, 13, splits, 8);
      expect(strip[strip.length - 1].dayNumber).toBe(14);
      expect(strip).toHaveLength(8);
    });
  });
});
