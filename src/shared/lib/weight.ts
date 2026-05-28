export const BAR_WEIGHT_LBS = 45;
export const BAR_WEIGHT_KG = 45 / 2.2046;

export const LBS_PLATES = [5, 10, 25, 35, 45];
export const KG_PLATES = [5, 10, 15, 20];

export function lbsToKg(lbs: number): number {
  return lbs / 2.2046;
}

export function kgToLbs(kg: number): number {
  return kg * 2.2046;
}

/** Keeps leading digits only so pasted values like "12.5" become "12", not "125". */
export function sanitizeIntegerInput(text: string): string {
  if (text === '') return '';
  const match = text.match(/^\d+/);
  return match?.[0] ?? '';
}

export function weightKgToDisplay(weightKg: number, unit: 'kg' | 'lbs'): number {
  if (unit === 'lbs') return Math.round(kgToLbs(weightKg));
  return Math.round(weightKg);
}

export function displayWeightToKg(display: number, unit: 'kg' | 'lbs'): number {
  if (unit === 'lbs') return lbsToKg(display);
  return display;
}

export function parseDisplayWeightToKg(value: string, unit: 'kg' | 'lbs'): number {
  const display = parseInt(value, 10) || 0;
  return displayWeightToKg(display, unit);
}

export function normalizeWeightKg(weightKg: number, unit: 'kg' | 'lbs'): number {
  return displayWeightToKg(weightKgToDisplay(weightKg, unit), unit);
}

export function computePlateWeightKg(plates: Record<number, number>, unit: 'kg' | 'lbs'): number {
  const platesSum = Object.entries(plates).reduce(
    (sum, [weight, count]) => sum + Number(weight) * count * 2,
    0,
  );
  if (unit === 'lbs') {
    return lbsToKg(BAR_WEIGHT_LBS + platesSum);
  }
  return BAR_WEIGHT_KG + platesSum;
}

export function formatWeight(weightKg: number, unit: 'kg' | 'lbs'): string {
  return String(weightKgToDisplay(weightKg, unit));
}
