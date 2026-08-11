import { describe, expect, it } from 'vitest';
import {
  buildEffort,
  describeRir,
  formatRir,
  formatRirOption,
  getEffortLabels,
  getSetRir,
  rirToRpe,
  rpeToRir,
} from '../lib/effort';

describe('rpe <-> rir conversion', () => {
  it('maps the standard scale', () => {
    expect(rpeToRir(10)).toBe(0);
    expect(rpeToRir(9)).toBe(1);
    expect(rpeToRir(8)).toBe(2);
    expect(rpeToRir(6)).toBe(4);
  });

  it('round-trips', () => {
    for (const rir of [0, 1, 2, 3, 4]) {
      expect(rpeToRir(rirToRpe(rir))).toBe(rir);
    }
  });

  it('never goes negative for an out-of-range RPE', () => {
    expect(rpeToRir(11)).toBe(0);
  });

  it('clamps rpe to the 0-10 range', () => {
    expect(rirToRpe(-2)).toBe(10);
    expect(rirToRpe(20)).toBe(0);
  });
});

describe('getSetRir', () => {
  it('returns undefined when there is no effort', () => {
    expect(getSetRir(undefined)).toBeUndefined();
    expect(getSetRir({ toFailure: true })).toBeUndefined();
  });

  it('reads a stored rir', () => {
    expect(getSetRir({ toFailure: false, rir: 2 })).toBe(2);
  });

  it('converts a legacy rpe set so old history still reads', () => {
    expect(getSetRir({ toFailure: false, rpe: 9 })).toBe(1);
    expect(getSetRir({ toFailure: true, rpe: 10 })).toBe(0);
  });

  it('prefers rir when both are present', () => {
    expect(getSetRir({ toFailure: false, rpe: 7, rir: 0 })).toBe(0);
  });

  it('ignores non-finite values', () => {
    expect(getSetRir({ toFailure: false, rir: NaN })).toBeUndefined();
    expect(getSetRir({ toFailure: false, rpe: NaN })).toBeUndefined();
  });
});

describe('formatRir', () => {
  it('labels exact values', () => {
    expect(formatRir(0)).toBe('0 RIR');
    expect(formatRir(2)).toBe('2 RIR');
  });

  it('keeps the top option open-ended', () => {
    expect(formatRir(4)).toBe('4+ RIR');
    expect(formatRir(7)).toBe('4+ RIR');
  });

  it('formats scale buttons compactly', () => {
    expect(formatRirOption(0)).toBe('0');
    expect(formatRirOption(4)).toBe('4+');
  });
});

describe('describeRir', () => {
  it('reads naturally at each end', () => {
    expect(describeRir(0)).toBe('nothing left in the tank');
    expect(describeRir(1)).toBe('1 rep left in the tank');
    expect(describeRir(2)).toBe('2 reps left in the tank');
    expect(describeRir(4)).toBe('4 or more reps left');
  });
});

describe('buildEffort', () => {
  it('returns undefined when the set has no effort data', () => {
    expect(buildEffort(false, undefined)).toBeUndefined();
  });

  it('keeps a failure flag on its own', () => {
    expect(buildEffort(true, undefined)).toEqual({ toFailure: true });
  });

  it('keeps rir on its own', () => {
    expect(buildEffort(false, 2)).toEqual({ toFailure: false, rir: 2 });
  });

  it('stores rir 0 rather than dropping it as falsy', () => {
    expect(buildEffort(false, 0)).toEqual({ toFailure: false, rir: 0 });
  });

  it('keeps both together', () => {
    expect(buildEffort(true, 0)).toEqual({ toFailure: true, rir: 0 });
  });
});

describe('getEffortLabels', () => {
  it('surfaces both chips', () => {
    expect(getEffortLabels({ toFailure: true, rir: 0 })).toEqual({
      toFailure: true,
      rirLabel: '0 RIR',
    });
  });

  it('converts legacy rpe for display', () => {
    expect(getEffortLabels({ toFailure: false, rpe: 8 })).toEqual({
      toFailure: false,
      rirLabel: '2 RIR',
    });
  });

  it('is empty for a bare set', () => {
    expect(getEffortLabels(undefined)).toEqual({ toFailure: false, rirLabel: null });
  });
});
