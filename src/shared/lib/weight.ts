export const BAR_WEIGHT_LBS = 45;
export const BAR_WEIGHT_KG = 45 / 2.2046;

export const LBS_PLATES = [2.5, 5, 10, 25, 35, 45];
export const KG_PLATES = [1.25, 2.5, 5, 10, 15, 20];

export function lbsToKg(lbs: number): number {
  return lbs / 2.2046;
}

export function kgToLbs(kg: number): number {
  return kg * 2.2046;
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
  if (unit === 'lbs') {
    return Math.round(kgToLbs(weightKg) * 10) / 10 + '';
  }
  return Math.round(weightKg * 10) / 10 + '';
}
