import type { Split, Exercise, WorkoutCycle } from '../../features/splits/types';
import type { WorkoutSession } from '../../features/workout/types';
import type { WeightEntry } from '../../features/weight/types';

export const BACKUP_VERSION = 1 as const;
export const BACKUP_APP = 'grynd' as const;

export type GryndBackupPrefs = {
  weightUnit: 'kg' | 'lbs';
  autoAdvanceCycle: boolean;
  defaultRestSeconds: number;
};

export type GryndBackupData = {
  splits: Split[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  cycle: WorkoutCycle;
  prefs: GryndBackupPrefs;
  /**
   * Added after v1 shipped. Optional so backups exported before body-weight
   * tracking existed still import cleanly — the validator treats a missing
   * `weight` as an empty array rather than rejecting the whole file.
   */
  weight?: WeightEntry[];
};

export type GryndBackupV1 = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  app: typeof BACKUP_APP;
  data: GryndBackupData;
};

export type GryndBackup = GryndBackupV1;

export const DEFAULT_BACKUP_CYCLE: WorkoutCycle = {
  days: [],
  currentIndex: 0,
  lastAdvancedAt: null,
};
