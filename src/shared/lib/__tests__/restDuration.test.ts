import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REST_SECONDS,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  formatRestDuration,
  isRestPreset,
  isValidRestSeconds,
  normalizeRestSeconds,
  parseRestSeconds,
  stepRestSeconds,
} from '../restDuration';

describe('isValidRestSeconds', () => {
  it('accepts values inside the range, including custom ones', () => {
    expect(isValidRestSeconds(90)).toBe(true);
    expect(isValidRestSeconds(105)).toBe(true); // not a preset, still valid
    expect(isValidRestSeconds(MIN_REST_SECONDS)).toBe(true);
    expect(isValidRestSeconds(MAX_REST_SECONDS)).toBe(true);
  });

  it('rejects out-of-range and non-numeric values', () => {
    expect(isValidRestSeconds(0)).toBe(false);
    expect(isValidRestSeconds(MAX_REST_SECONDS + 1)).toBe(false);
    expect(isValidRestSeconds(NaN)).toBe(false);
    expect(isValidRestSeconds('90')).toBe(false);
    expect(isValidRestSeconds(null)).toBe(false);
  });
});

describe('isRestPreset', () => {
  it('separates presets from custom values', () => {
    expect(isRestPreset(90)).toBe(true);
    expect(isRestPreset(105)).toBe(false);
  });
});

describe('normalizeRestSeconds', () => {
  it('keeps a valid custom value rather than snapping to a preset', () => {
    expect(normalizeRestSeconds(105)).toBe(105);
  });

  it('clamps to the range', () => {
    expect(normalizeRestSeconds(1)).toBe(MIN_REST_SECONDS);
    expect(normalizeRestSeconds(99999)).toBe(MAX_REST_SECONDS);
  });

  it('rounds fractional seconds', () => {
    expect(normalizeRestSeconds(90.6)).toBe(91);
  });

  it('falls back for unusable input', () => {
    expect(normalizeRestSeconds(NaN)).toBe(DEFAULT_REST_SECONDS);
    expect(normalizeRestSeconds('90')).toBe(DEFAULT_REST_SECONDS);
    expect(normalizeRestSeconds(undefined, 120)).toBe(120);
  });
});

describe('parseRestSeconds', () => {
  it('reads a stored custom value back unchanged', () => {
    expect(parseRestSeconds('105')).toBe(105);
  });

  it('falls back on missing or junk storage', () => {
    expect(parseRestSeconds(null)).toBe(DEFAULT_REST_SECONDS);
    expect(parseRestSeconds('abc')).toBe(DEFAULT_REST_SECONDS);
  });

  it('clamps a stored value that is out of range', () => {
    expect(parseRestSeconds('5')).toBe(MIN_REST_SECONDS);
  });
});

describe('stepRestSeconds', () => {
  it('steps up and down', () => {
    expect(stepRestSeconds(90, 15)).toBe(105);
    expect(stepRestSeconds(90, -15)).toBe(75);
  });

  it('stops at the bounds instead of going past them', () => {
    expect(stepRestSeconds(MIN_REST_SECONDS, -15)).toBe(MIN_REST_SECONDS);
    expect(stepRestSeconds(MAX_REST_SECONDS, 15)).toBe(MAX_REST_SECONDS);
  });
});

describe('formatRestDuration', () => {
  it('uses seconds below a minute', () => {
    expect(formatRestDuration(45)).toBe('45s');
  });

  it('uses minutes and seconds above one', () => {
    expect(formatRestDuration(60)).toBe('1:00');
    expect(formatRestDuration(105)).toBe('1:45');
    expect(formatRestDuration(120)).toBe('2:00');
  });

  it('pads the seconds', () => {
    expect(formatRestDuration(65)).toBe('1:05');
  });

  it('never renders a negative duration', () => {
    expect(formatRestDuration(-10)).toBe('0s');
  });
});
