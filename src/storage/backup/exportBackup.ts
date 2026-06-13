import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSplits, getExercises } from '../adapters/splits';
import { getSessions } from '../adapters/sessions';
import { getWorkoutCycle } from '../adapters/cycle';
import { STORAGE_KEYS } from '../keys';
import {
  DEFAULT_REST_SECONDS,
  REST_DURATION_OPTIONS,
} from '../../shared/store/prefsStore';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  DEFAULT_BACKUP_CYCLE,
  type GryndBackupV1,
  type GryndBackupPrefs,
} from './types';

function parseDefaultRestSeconds(raw: string | null): number {
  const parsed = parseInt(raw ?? '', 10);
  return (REST_DURATION_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_REST_SECONDS;
}

async function readBackupPrefs(): Promise<GryndBackupPrefs> {
  const [weightRaw, autoAdvanceRaw, restRaw] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT),
    AsyncStorage.getItem(STORAGE_KEYS.AUTO_ADVANCE_CYCLE),
    AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_REST_SECONDS),
  ]);

  return {
    weightUnit: weightRaw === 'lbs' ? 'lbs' : 'kg',
    autoAdvanceCycle: autoAdvanceRaw !== 'false',
    defaultRestSeconds: parseDefaultRestSeconds(restRaw),
  };
}

export async function exportBackup(): Promise<GryndBackupV1> {
  const [splits, exercises, sessions, cycle, prefs] = await Promise.all([
    getSplits(),
    getExercises(),
    getSessions(),
    getWorkoutCycle(),
    readBackupPrefs(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: BACKUP_APP,
    data: {
      splits,
      exercises,
      sessions,
      cycle: cycle ?? DEFAULT_BACKUP_CYCLE,
      prefs,
    },
  };
}
