import { describe, expect, it } from 'vitest';
import {
  MAX_BODY_WEIGHT_LBS,
  bodyWeightDeltaToDisplay,
  bodyWeightToDisplay,
  displayToLbs,
  formatBodyWeight,
  formatBodyWeightDelta,
  formatBodyWeightValue,
  maxBodyWeightInUnit,
  unitLabel,
} from '../weightUnits';

describe('bodyWeightToDisplay', () => {
  it('passes pounds through unchanged for a lbs user', () => {
    expect(bodyWeightToDisplay(181.4, 'lbs')).toBe(181.4);
  });

  it('converts to kilograms for a kg user', () => {
    // 181.4 lb ≈ 82.28 kg → one decimal
    expect(bodyWeightToDisplay(181.4, 'kg')).toBe(82.3);
  });

  it('rounds to one decimal in both units', () => {
    expect(bodyWeightToDisplay(181.44444, 'lbs')).toBe(181.4);
    expect(bodyWeightToDisplay(200, 'kg')).toBe(90.7);
  });
});

describe('displayToLbs', () => {
  it('passes pounds through unchanged for a lbs user', () => {
    expect(displayToLbs(181.4, 'lbs')).toBe(181.4);
  });

  it('converts a typed kilogram value into stored pounds', () => {
    // The bug this guards: a kg user typing 82 must not store 82 lb.
    expect(displayToLbs(82, 'kg')).toBeCloseTo(180.8, 1);
    expect(displayToLbs(82, 'kg')).toBeGreaterThan(180);
  });
});

describe('round trip', () => {
  it('survives lbs → display → lbs within a tenth', () => {
    for (const lbs of [120, 154.3, 181.4, 220.7, 305]) {
      for (const unit of ['kg', 'lbs'] as const) {
        const shown = bodyWeightToDisplay(lbs, unit);
        const stored = displayToLbs(shown, unit);
        expect(Math.abs(stored - lbs)).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it('survives display → lbs → display exactly', () => {
    for (const kg of [60, 75.5, 82.3, 100]) {
      const stored = displayToLbs(kg, 'kg');
      expect(bodyWeightToDisplay(stored, 'kg')).toBeCloseTo(kg, 1);
    }
  });
});

describe('formatting', () => {
  it('drops the decimal on whole numbers', () => {
    expect(formatBodyWeightValue(180, 'lbs')).toBe('180');
    expect(formatBodyWeight(180, 'lbs')).toBe('180 lb');
  });

  it('keeps one decimal otherwise', () => {
    expect(formatBodyWeightValue(181.4, 'lbs')).toBe('181.4');
    expect(formatBodyWeight(181.4, 'kg')).toBe('82.3 kg');
  });

  it('uses lb, not lbs, as the display suffix', () => {
    expect(unitLabel('lbs')).toBe('lb');
    expect(unitLabel('kg')).toBe('kg');
  });
});

describe('deltas', () => {
  it('converts a delta linearly, with no offset', () => {
    expect(bodyWeightDeltaToDisplay(2.2, 'lbs')).toBe(2.2);
    expect(bodyWeightDeltaToDisplay(2.2, 'kg')).toBe(1);
  });

  it('formats magnitude only — direction is the caller\'s arrow', () => {
    expect(formatBodyWeightDelta(-2.2, 'lbs')).toBe('2.2 lb');
    expect(formatBodyWeightDelta(2.2, 'lbs')).toBe('2.2 lb');
  });
});

describe('maxBodyWeightInUnit', () => {
  it('keeps a kg user under the stored pound ceiling', () => {
    const maxKg = maxBodyWeightInUnit('kg');
    expect(displayToLbs(maxKg, 'kg')).toBeLessThanOrEqual(MAX_BODY_WEIGHT_LBS);
  });

  it('is the raw ceiling for a lbs user', () => {
    expect(maxBodyWeightInUnit('lbs')).toBe(MAX_BODY_WEIGHT_LBS);
  });
});
