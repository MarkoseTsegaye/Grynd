import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../keys';
import type { Split, Exercise } from '../../features/splits/types';

export async function getSplits(): Promise<Split[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SPLITS);
    return raw ? (JSON.parse(raw) as Split[]) : [];
  } catch {
    return [];
  }
}

export async function saveSplits(splits: Split[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SPLITS, JSON.stringify(splits));
  } catch (err) {
    throw new Error(`Failed to save splits: ${String(err)}`);
  }
}

export async function getExercises(): Promise<Exercise[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
    return raw ? (JSON.parse(raw) as Exercise[]) : [];
  } catch {
    return [];
  }
}

export async function saveExercises(exercises: Exercise[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
  } catch (err) {
    throw new Error(`Failed to save exercises: ${String(err)}`);
  }
}
