/**
 * Rest duration rules, kept in one pure module.
 *
 * Three places previously decided independently whether a rest value was
 * acceptable — the prefs store on load, the backup export, and the backup
 * validator — and all three required membership in the preset list. That made
 * a custom duration impossible to persist, and would have made any backup
 * containing one fail validation outright.
 */

export const REST_PRESETS = [60, 90, 120, 180] as const;

export const DEFAULT_REST_SECONDS = 90;

/** Below this a timer is pointless; above it, it is not a rest between sets. */
export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;

/** Custom values move in the same increments the running timer adjusts by. */
export const REST_STEP_SECONDS = 15;

export function isValidRestSeconds(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_REST_SECONDS &&
    value <= MAX_REST_SECONDS
  );
}

export function isRestPreset(seconds: number): boolean {
  return (REST_PRESETS as readonly number[]).includes(seconds);
}

/** Clamps into range and drops fractional seconds; falls back when unusable. */
export function normalizeRestSeconds(
  value: unknown,
  fallback: number = DEFAULT_REST_SECONDS,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < MIN_REST_SECONDS) return MIN_REST_SECONDS;
  if (rounded > MAX_REST_SECONDS) return MAX_REST_SECONDS;
  return rounded;
}

export function parseRestSeconds(raw: string | null): number {
  const parsed = parseInt(raw ?? '', 10);
  return Number.isNaN(parsed) ? DEFAULT_REST_SECONDS : normalizeRestSeconds(parsed);
}

/** Steps a custom value, staying inside the allowed range. */
export function stepRestSeconds(seconds: number, delta: number): number {
  return normalizeRestSeconds(seconds + delta);
}

/** "45s" under a minute, "2:00" / "1:45" above it. */
export function formatRestDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
