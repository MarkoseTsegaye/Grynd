import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../keys';
import type { WorkoutCycle } from '../../features/splits/types';

export async function getWorkoutCycle(): Promise<WorkoutCycle | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_CYCLE);
    if (!raw) return null;
    const cycle = JSON.parse(raw) as WorkoutCycle;
    // Backfill `updatedAt` for cycles saved before phase 3 (the field
    // didn't exist). Prefer `lastAdvancedAt` since it's the closest
    // meaningful timestamp; fall back to `now()` if the cycle has never
    // advanced.
    if (typeof cycle.updatedAt !== 'number') {
      cycle.updatedAt = cycle.lastAdvancedAt ?? Date.now();
    }
    return cycle;
  } catch {
    return null;
  }
}

export async function saveWorkoutCycle(cycle: WorkoutCycle): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_CYCLE, JSON.stringify(cycle));
  } catch (err) {
    throw new Error(`Failed to save cycle: ${String(err)}`);
  }
}
