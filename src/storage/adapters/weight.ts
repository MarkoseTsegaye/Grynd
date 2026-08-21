import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../keys';
import type { WeightEntry } from '../../features/weight/types';

export async function getWeightEntries(): Promise<WeightEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES);
    return raw ? (JSON.parse(raw) as WeightEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveWeightEntries(entries: WeightEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(entries));
  } catch (err) {
    throw new Error(`Failed to save weight entries: ${String(err)}`);
  }
}
