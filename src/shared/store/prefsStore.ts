import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';

type WeightUnit = 'kg' | 'lbs';

export type BackupPrefs = {
  weightUnit: WeightUnit;
  autoAdvanceCycle: boolean;
  defaultRestSeconds: number;
};

export const REST_DURATION_OPTIONS = [60, 90, 120, 180] as const;
export const DEFAULT_REST_SECONDS = 90;

function parseDefaultRestSeconds(raw: string | null): number {
  const parsed = parseInt(raw ?? '', 10);
  return (REST_DURATION_OPTIONS as readonly number[]).includes(parsed) ? parsed : DEFAULT_REST_SECONDS;
}

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
            defaultRestSeconds: parseDefaultRestSeconds(restRaw),
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
        set({ defaultRestSeconds: seconds });
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_REST_SECONDS, String(seconds));
        } catch {
          // ignore
        }
      },

      importPrefs: async (prefs) => {
        const weightUnit: WeightUnit = prefs.weightUnit === 'lbs' ? 'lbs' : 'kg';
        const autoAdvanceCycle = prefs.autoAdvanceCycle;
        const defaultRestSeconds = prefs.defaultRestSeconds;

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
