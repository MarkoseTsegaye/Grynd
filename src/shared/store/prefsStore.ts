import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';

type WeightUnit = 'kg' | 'lbs';

interface PrefsState {
  weightUnit: WeightUnit;
  isLoaded: boolean;
  loadPrefs: () => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
}

export const usePrefsStore = create<PrefsState>()(
  devtools(
    (set) => ({
      weightUnit: 'kg',
      isLoaded: false,

      loadPrefs: async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT);
          set({ weightUnit: raw === 'lbs' ? 'lbs' : 'kg', isLoaded: true });
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
    }),
    { name: 'PrefsStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
