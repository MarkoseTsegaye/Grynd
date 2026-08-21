import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSplits, getExercises } from '../adapters/splits';
import { getSessions } from '../adapters/sessions';
import { getWorkoutCycle } from '../adapters/cycle';
import { getWeightEntries } from '../adapters/weight';
import { STORAGE_KEYS } from '../keys';
import { parseRestSeconds } from '../../shared/lib/restDuration';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  DEFAULT_BACKUP_CYCLE,
  type GryndBackupV1,
  type GryndBackupPrefs,
} from './types';

async function readBackupPrefs(): Promise<GryndBackupPrefs> {
  const [weightRaw, autoAdvanceRaw, restRaw] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT),
    AsyncStorage.getItem(STORAGE_KEYS.AUTO_ADVANCE_CYCLE),
    AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_REST_SECONDS),
  ]);

  return {
    weightUnit: weightRaw === 'lbs' ? 'lbs' : 'kg',
    autoAdvanceCycle: autoAdvanceRaw !== 'false',
    defaultRestSeconds: parseRestSeconds(restRaw),
  };
}

export async function exportBackup(): Promise<GryndBackupV1> {
  const [splits, exercises, sessions, cycle, prefs, weight] = await Promise.all([
    getSplits(),
    getExercises(),
    getSessions(),
    getWorkoutCycle(),
    readBackupPrefs(),
    getWeightEntries(),
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
      weight,
    },
  };
}
