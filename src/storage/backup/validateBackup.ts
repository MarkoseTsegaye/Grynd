import { REST_DURATION_OPTIONS } from '../../shared/store/prefsStore';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  type GryndBackup,
  type GryndBackupPrefs,
} from './types';

export type BackupValidationResult =
  | { ok: true; backup: GryndBackup }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function validatePrefs(value: unknown): GryndBackupPrefs | null {
  if (!isRecord(value)) return null;

  const weightUnit = value.weightUnit === 'lbs' ? 'lbs' : value.weightUnit === 'kg' ? 'kg' : null;
  if (!weightUnit) return null;

  if (typeof value.autoAdvanceCycle !== 'boolean') return null;

  if (typeof value.defaultRestSeconds !== 'number') return null;
  if (!(REST_DURATION_OPTIONS as readonly number[]).includes(value.defaultRestSeconds)) return null;

  return {
    weightUnit,
    autoAdvanceCycle: value.autoAdvanceCycle,
    defaultRestSeconds: value.defaultRestSeconds,
  };
}

function validateCycle(value: unknown): GryndBackup['data']['cycle'] | null {
  if (!isRecord(value)) return null;
  if (!isArray(value.days)) return null;
  if (typeof value.currentIndex !== 'number') return null;
  if (value.lastAdvancedAt !== null && typeof value.lastAdvancedAt !== 'number') return null;

  const days: GryndBackup['data']['cycle']['days'] = [];

  for (const day of value.days) {
    if (!isRecord(day)) return null;
    if (!isNonEmptyString(day.id)) return null;
    if (day.type !== 'split' && day.type !== 'rest') return null;

    // An unassigned split day may carry null instead of omitting the key.
    // Normalize rather than reject: refusing the whole file over one cycle
    // entry would make an otherwise-good backup permanently unimportable.
    const splitId = typeof day.splitId === 'string' ? day.splitId : undefined;
    if (day.splitId !== undefined && day.splitId !== null && splitId === undefined) {
      return null;
    }

    days.push({
      id: day.id,
      type: day.type,
      ...(splitId !== undefined ? { splitId } : {}),
    });
  }

  return {
    days,
    currentIndex: value.currentIndex,
    lastAdvancedAt: value.lastAdvancedAt,
  };
}

export function validateBackup(value: unknown): BackupValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'The selected file is not a valid Grynd backup.' };
  }

  if (value.app !== BACKUP_APP) {
    return { ok: false, error: 'This file was not exported from Grynd.' };
  }

  if (value.version !== BACKUP_VERSION) {
    return { ok: false, error: 'This backup version is not supported by this app.' };
  }

  if (!isNonEmptyString(value.exportedAt)) {
    return { ok: false, error: 'The backup file is missing export metadata.' };
  }

  if (!isRecord(value.data)) {
    return { ok: false, error: 'The backup file is missing data.' };
  }

  const { data } = value;

  if (!isArray(data.splits) || !isArray(data.exercises) || !isArray(data.sessions)) {
    return { ok: false, error: 'The backup file is missing required data.' };
  }

  const prefs = validatePrefs(data.prefs);
  if (!prefs) {
    return { ok: false, error: 'The backup file has invalid preferences.' };
  }

  const cycle = validateCycle(data.cycle);
  if (!cycle) {
    return { ok: false, error: 'The backup file has invalid cycle data.' };
  }

  return {
    ok: true,
    backup: {
      version: BACKUP_VERSION,
      exportedAt: value.exportedAt,
      app: BACKUP_APP,
      data: {
        splits: data.splits as GryndBackup['data']['splits'],
        exercises: data.exercises as GryndBackup['data']['exercises'],
        sessions: data.sessions as GryndBackup['data']['sessions'],
        cycle,
        prefs,
      },
    },
  };
}
