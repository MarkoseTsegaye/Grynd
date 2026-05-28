import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';

type WeightUnit = 'kg' | 'lbs';

interface PrefsState {
  weightUnit: WeightUnit;
  autoAdvanceCycle: boolean;
  isLoaded: boolean;
  loadPrefs: () => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setAutoAdvanceCycle: (value: boolean) => Promise<void>;
}

export const usePrefsStore = create<PrefsState>()(
  devtools(
    (set) => ({
      weightUnit: 'kg',
      autoAdvanceCycle: true,
      isLoaded: false,

      loadPrefs: async () => {
        try {
          const [weightRaw, autoAdvanceRaw] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT),
            AsyncStorage.getItem(STORAGE_KEYS.AUTO_ADVANCE_CYCLE),
          ]);
          set({
            weightUnit: weightRaw === 'lbs' ? 'lbs' : 'kg',
            autoAdvanceCycle: autoAdvanceRaw !== 'false',
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
    }),
    { name: 'PrefsStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
