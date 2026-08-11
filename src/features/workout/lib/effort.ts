import type { LoggedSet } from '../types';

type Effort = NonNullable<LoggedSet['effort']>;

/**
 * Values offered by the inline pad. The last one is open-ended ("4+") because
 * past four reps in reserve the exact number stops carrying information.
 */
export const RIR_OPTIONS = [0, 1, 2, 3, 4] as const;

export const MAX_RIR_OPTION = 4;

/**
 * Standard Zourdos mapping: RPE 10 = 0 RIR, RPE 6 = 4 RIR. Lossless across the
 * range the app can produce, which is what lets old RPE sets read back as RIR
 * without a data migration.
 */
export function rpeToRir(rpe: number): number {
  return Math.max(0, 10 - rpe);
}

export function rirToRpe(rir: number): number {
  return Math.min(10, Math.max(0, 10 - rir));
}

/** Reads RIR off a set, falling back to converting a legacy RPE value. */
export function getSetRir(effort: Effort | undefined): number | undefined {
  if (!effort) return undefined;
  if (effort.rir !== undefined && Number.isFinite(effort.rir)) {
    return Math.max(0, effort.rir);
  }
  if (effort.rpe !== undefined && Number.isFinite(effort.rpe)) {
    return rpeToRir(effort.rpe);
  }
  return undefined;
}

/** "0 RIR" / "4+ RIR" — the open-ended top option keeps its plus. */
export function formatRir(rir: number): string {
  return rir >= MAX_RIR_OPTION ? `${MAX_RIR_OPTION}+ RIR` : `${rir} RIR`;
}

/** Short label for a scale button ("4+" for the open-ended option). */
export function formatRirOption(rir: number): string {
  return rir >= MAX_RIR_OPTION ? `${MAX_RIR_OPTION}+` : String(rir);
}

export function describeRir(rir: number): string {
  if (rir <= 0) return 'nothing left in the tank';
  if (rir >= MAX_RIR_OPTION) return `${MAX_RIR_OPTION} or more reps left`;
  return rir === 1 ? '1 rep left in the tank' : `${rir} reps left in the tank`;
}

/**
 * Builds the effort object to store, or undefined when the set carries no
 * effort data at all (so we don't persist empty objects).
 */
export function buildEffort(
  toFailure: boolean,
  rir: number | undefined,
): Effort | undefined {
  if (!toFailure && rir === undefined) return undefined;
  return { toFailure, ...(rir !== undefined ? { rir } : {}) };
}

/** Chips a logged set should show for its effort, most severe first. */
export function getEffortLabels(effort: Effort | undefined): {
  toFailure: boolean;
  rirLabel: string | null;
} {
  const rir = getSetRir(effort);
  return {
    toFailure: !!effort?.toFailure,
    rirLabel: rir === undefined ? null : formatRir(rir),
  };
}
