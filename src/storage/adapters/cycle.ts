import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../keys';
import type { WorkoutCycle } from '../../features/splits/types';

export async function getWorkoutCycle(): Promise<WorkoutCycle | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_CYCLE);
    return raw ? (JSON.parse(raw) as WorkoutCycle) : null;
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
