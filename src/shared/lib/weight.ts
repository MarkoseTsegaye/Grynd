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
  const kg = Number.isFinite(weightKg) ? weightKg : 0;
  const display = unit === 'lbs' ? kgToLbs(kg) : kg;
  // Keep 0.1 precision so fractional plates/weights (e.g. 72.5) survive;
  // whole numbers stay whole (72 -> 72, not 72.0).
  return Math.round(display * 10) / 10;
}

export function displayWeightToKg(display: number, unit: 'kg' | 'lbs'): number {
  if (unit === 'lbs') return lbsToKg(display);
  return display;
}

export function parseDisplayWeightToKg(value: string, unit: 'kg' | 'lbs'): number {
  const display = parseFloat(value) || 0;
  return displayWeightToKg(display, unit);
}

export function normalizeWeightKg(weightKg: number, unit: 'kg' | 'lbs'): number {
  return displayWeightToKg(weightKgToDisplay(weightKg, unit), unit);
}

export function formatPlatesPerSide(perSide: Record<number, number>): string {
  return Object.entries(perSide)
    .map(([weight, count]) => ({ weight: Number(weight), count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.weight - a.weight)
    .map(({ weight, count }) => `${weight} × ${count}`)
    .join(', ');
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

type SetWeightDisplayInput = {
  weightKg: number;
  plates?: { unit: 'kg' | 'lbs'; perSide: Record<number, number> };
};

export function formatSetWeightDisplay(
  set: SetWeightDisplayInput,
  weightUnit: 'kg' | 'lbs',
): { weightText: string; unitLabel: string | null } {
  if (set.plates && formatPlatesPerSide(set.plates.perSide) !== '') {
    return {
      weightText: formatPlatesPerSide(set.plates.perSide),
      unitLabel: null,
    };
  }
  return {
    weightText: formatWeight(set.weightKg, weightUnit),
    unitLabel: weightUnit,
  };
}
