import { saveSplits, saveExercises } from '../adapters/splits';
import { clearActiveSession, saveSessions } from '../adapters/sessions';
import { saveWorkoutCycle } from '../adapters/cycle';
import { usePrefsStore } from '../../shared/store/prefsStore';
import type { GryndBackup } from './types';

export async function importBackup(backup: GryndBackup): Promise<void> {
  const { splits, exercises, sessions, cycle, prefs } = backup.data;

  await clearActiveSession();
  await saveSplits(splits);
  await saveExercises(exercises);
  await saveSessions(sessions);
  await saveWorkoutCycle(cycle);
  await usePrefsStore.getState().importPrefs(prefs);
}
