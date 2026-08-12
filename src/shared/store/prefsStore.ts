import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';
import {
  DEFAULT_REST_SECONDS,
  REST_PRESETS,
  normalizeRestSeconds,
  parseRestSeconds,
} from '../lib/restDuration';

// Re-exported so existing consumers keep one import site for these.
export { DEFAULT_REST_SECONDS, REST_PRESETS };

type WeightUnit = 'kg' | 'lbs';

export type BackupPrefs = {
  weightUnit: WeightUnit;
  autoAdvanceCycle: boolean;
  defaultRestSeconds: number;
};


interface PrefsState {
  weightUnit: WeightUnit;
  autoAdvanceCycle: boolean;
  defaultRestSeconds: number;
  isLoaded: boolean;
  loadPrefs: () => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setAutoAdvanceCycle: (value: boolean) => Promise<void>;
  setDefaultRestSeconds: (seconds: number) => Promise<void>;
  importPrefs: (prefs: BackupPrefs) => Promise<void>;
}

export const usePrefsStore = create<PrefsState>()(
  devtools(
    (set) => ({
      weightUnit: 'kg',
      autoAdvanceCycle: true,
      defaultRestSeconds: DEFAULT_REST_SECONDS,
      isLoaded: false,

      loadPrefs: async () => {
        try {
          const [weightRaw, autoAdvanceRaw, restRaw] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT),
            AsyncStorage.getItem(STORAGE_KEYS.AUTO_ADVANCE_CYCLE),
            AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_REST_SECONDS),
          ]);
          set({
            weightUnit: weightRaw === 'lbs' ? 'lbs' : 'kg',
            autoAdvanceCycle: autoAdvanceRaw !== 'false',
            defaultRestSeconds: parseRestSeconds(restRaw),
            isLoaded: true,
          });
        } catch {
          set({ isLoaded: true });
        }
      },

      setWeightUnit: async (unit) => {
        set({ weightUnit: unit });
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_UNIT, unit);
        } catch {
          // ignore
        }
      },

      setAutoAdvanceCycle: async (value) => {
        set({ autoAdvanceCycle: value });
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.AUTO_ADVANCE_CYCLE, value ? 'true' : 'false');
        } catch {
          // ignore
        }
      },

      setDefaultRestSeconds: async (seconds) => {
        const normalized = normalizeRestSeconds(seconds);
        set({ defaultRestSeconds: normalized });
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_REST_SECONDS, String(normalized));
        } catch {
          // ignore
        }
      },

      importPrefs: async (prefs) => {
        const weightUnit: WeightUnit = prefs.weightUnit === 'lbs' ? 'lbs' : 'kg';
        const autoAdvanceCycle = prefs.autoAdvanceCycle;
        const defaultRestSeconds = normalizeRestSeconds(prefs.defaultRestSeconds);

        set({ weightUnit, autoAdvanceCycle, defaultRestSeconds });
        try {
          await Promise.all([
            AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_UNIT, weightUnit),
            AsyncStorage.setItem(
              STORAGE_KEYS.AUTO_ADVANCE_CYCLE,
              autoAdvanceCycle ? 'true' : 'false',
            ),
            AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_REST_SECONDS, String(defaultRestSeconds)),
          ]);
        } catch (err) {
          throw new Error(`Failed to import preferences: ${String(err)}`);
        }
      },
    }),
    { name: 'PrefsStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
