import { describe, expect, it } from 'vitest';
import { DEFAULT_SPLIT_GLYPH, getSplitGlyph } from '../lib/splitGlyph';

describe('getSplitGlyph', () => {
  it('recognises the common split types', () => {
    expect(getSplitGlyph('Push')).toBe('arm-flex');
    expect(getSplitGlyph('Pull')).toBe('weight-lifter');
    expect(getSplitGlyph('Legs')).toBe('human-handsdown');
  });

  it('ignores case and surrounding words', () => {
    expect(getSplitGlyph('heavy PUSH day')).toBe('arm-flex');
    expect(getSplitGlyph('Leg Day')).toBe('human-handsdown');
  });

  it('handles the plural names people actually use', () => {
    expect(getSplitGlyph('Legs')).toBe('human-handsdown');
    expect(getSplitGlyph('Shoulders')).toBe('kettlebell');
    expect(getSplitGlyph('Arms')).toBe('arm-flex-outline');
    expect(getSplitGlyph('Abs')).toBe('human');
  });

  it('matches on muscle groups, not just the split name', () => {
    expect(getSplitGlyph('Chest & Triceps')).toBe('arm-flex');
    expect(getSplitGlyph('Shoulders')).toBe('kettlebell');
    expect(getSplitGlyph('Core')).toBe('human');
  });

  it('falls back to a neutral glyph for an unrecognised name', () => {
    // Better to look generic than to be confidently mislabelled.
    expect(getSplitGlyph('Wednesday')).toBe(DEFAULT_SPLIT_GLYPH);
    expect(getSplitGlyph('Session A')).toBe(DEFAULT_SPLIT_GLYPH);
  });

  it('falls back for an empty or whitespace name', () => {
    expect(getSplitGlyph('')).toBe(DEFAULT_SPLIT_GLYPH);
    expect(getSplitGlyph('   ')).toBe(DEFAULT_SPLIT_GLYPH);
  });

  it('does not match a word fragment', () => {
    // "pushover" should not read as a push day
    expect(getSplitGlyph('Pushover')).toBe(DEFAULT_SPLIT_GLYPH);
  });
});
