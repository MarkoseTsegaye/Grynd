import { kgToLbs, lbsToKg, unitLabel } from '../../../shared/lib/weight';

export type WeightUnit = 'kg' | 'lbs';

/**
 * Body-weight entries are stored lb-canonical (`WeightEntry.weightLbs`)
 * while workout sets are stored kg-canonical (`LoggedSet.weightKg`).
 * That means the shared `weightKgToDisplay` / `formatWeight` helpers in
 * `shared/lib/weight.ts` CANNOT be pointed at a weight entry — they
 * would read a pound value as kilograms. These four functions are the
 * only correct path between a stored entry and what the user sees.
 *
 * Everything rounds to one decimal: a bathroom scale's real precision,
 * and enough that a kg → lb → kg round trip doesn't visibly drift.
 */

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Stored pounds → the number to show in the user's chosen unit. */
export function bodyWeightToDisplay(lbs: number, unit: WeightUnit): number {
  return round1(unit === 'kg' ? lbsToKg(lbs) : lbs);
}

/** A number the user typed in their chosen unit → pounds to store. */
export function displayToLbs(value: number, unit: WeightUnit): number {
  return round1(unit === 'kg' ? kgToLbs(value) : value);
}

/** Bare number, no unit suffix — for a value that already has a label beside it. */
export function formatBodyWeightValue(lbs: number, unit: WeightUnit): string {
  const rounded = bodyWeightToDisplay(lbs, unit);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

/** Full display string including the unit, e.g. `"82.3 kg"` / `"181.4 lb"`. */
export function formatBodyWeight(lbs: number, unit: WeightUnit): string {
  return `${formatBodyWeightValue(lbs, unit)} ${unitLabel(unit)}`;
}

/**
 * A difference between two stored pound values, converted for display.
 * Deltas scale linearly so this is a plain conversion, not a
 * two-point subtraction — but it exists so callers never hand a delta
 * to `bodyWeightToDisplay` and wonder whether an offset applies.
 */
export function bodyWeightDeltaToDisplay(deltaLbs: number, unit: WeightUnit): number {
  return round1(unit === 'kg' ? lbsToKg(deltaLbs) : deltaLbs);
}

/** Formats the magnitude of a delta — callers render the direction arrow. */
export function formatBodyWeightDelta(deltaLbs: number, unit: WeightUnit): string {
  const magnitude = Math.abs(bodyWeightDeltaToDisplay(deltaLbs, unit));
  const numeric = Number.isInteger(magnitude) ? `${magnitude}` : magnitude.toFixed(1);
  return `${numeric} ${unitLabel(unit)}`;
}

/**
 * Re-exported from `shared/lib/weight` so body-weight callers keep a single
 * import; the label depends only on the unit, not on which canonical unit
 * the value was stored in.
 */
export { unitLabel };

/**
 * Upper bound on a body-weight entry, expressed in the unit the user is
 * typing in. The stored ceiling is 1000 lb; a kg user must not be able
 * to type a number that exceeds it after conversion.
 */
export const MAX_BODY_WEIGHT_LBS = 1000;

export function maxBodyWeightInUnit(unit: WeightUnit): number {
  return Math.floor(bodyWeightToDisplay(MAX_BODY_WEIGHT_LBS, unit));
}
