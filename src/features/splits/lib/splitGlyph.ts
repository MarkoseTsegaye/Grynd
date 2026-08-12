import type { ComponentProps } from 'react';
import type { Icon } from '../../../shared/components/Icon';

type IconName = ComponentProps<typeof Icon>['name'];

/**
 * Split-type glyphs, replacing the single 🏋️ emoji used for every split.
 *
 * Matching is on the split's own name because the app has no split-type field
 * and inventing one would mean a migration plus an editor for something the
 * name already says. Unrecognised names fall back to a neutral dumbbell, so a
 * split called "Wednesday" simply looks generic rather than mislabelled.
 */
/**
 * Each keyword allows an optional trailing "s": people name splits "Legs" and
 * "Shoulders", not "Leg" and "Shoulder", and a bare \bword\b misses both. The
 * boundary is kept so "Pushover" still does not read as a push day.
 */
const GLYPH_RULES: { pattern: RegExp; icon: IconName }[] = [
  { pattern: /\b(?:push|chest|bench|press)s?\b/i, icon: 'arm-flex' },
  { pattern: /\b(?:pull|back|row|lat)s?\b/i, icon: 'weight-lifter' },
  { pattern: /\b(?:leg|squat|quad|hamstring|glute|lower)s?\b/i, icon: 'human-handsdown' },
  { pattern: /\b(?:arm|bicep|tricep|curl)s?\b/i, icon: 'arm-flex-outline' },
  { pattern: /\b(?:shoulder|delt|overhead)s?\b/i, icon: 'kettlebell' },
  { pattern: /\b(?:core|ab|oblique)s?\b/i, icon: 'human' },
  { pattern: /\b(?:cardio|run|bike|conditioning)s?\b/i, icon: 'run-fast' },
  { pattern: /\b(?:full|upper|total)s?\b/i, icon: 'weight-lifter' },
];

export const DEFAULT_SPLIT_GLYPH: IconName = 'dumbbell';

export function getSplitGlyph(splitName: string): IconName {
  const name = splitName.trim();
  if (name.length === 0) return DEFAULT_SPLIT_GLYPH;

  for (const rule of GLYPH_RULES) {
    if (rule.pattern.test(name)) return rule.icon;
  }
  return DEFAULT_SPLIT_GLYPH;
}
