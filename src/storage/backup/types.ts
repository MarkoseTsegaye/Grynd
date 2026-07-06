import type { Split, Exercise, WorkoutCycle } from '../../features/splits/types';
import type { WorkoutSession } from '../../features/workout/types';

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
