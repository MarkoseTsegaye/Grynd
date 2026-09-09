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

/**
 * Prefs the sync layer sees as a single row per user, even though on
 * device they live under three separate AsyncStorage keys. The
 * `updatedAt` timestamp is what LWW compares against the server.
 */
export interface PrefsSyncRow {
  weightUnit: WeightUnit;
  autoAdvanceCycle: boolean;
  defaultRestSeconds: number;
  updatedAt: number;
}

async function readUpdatedAt(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PREFS_UPDATED_AT);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function writeUpdatedAt(ms: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PREFS_UPDATED_AT, String(ms));
  } catch {
    // Non-fatal — sync layer will still catch changes via the next
    // successful write. Missing timestamp means the row will look
    // "older than the server" and get overwritten from the server,
    // which is safe (the setter above already updated the visible
    // pref).
  }
}

interface PrefsState {
  weightUnit: WeightUnit;
  autoAdvanceCycle: boolean;
  defaultRestSeconds: number;
  updatedAt: number;
  isLoaded: boolean;
  loadPrefs: () => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setAutoAdvanceCycle: (value: boolean) => Promise<void>;
  setDefaultRestSeconds: (seconds: number) => Promise<void>;
  importPrefs: (prefs: BackupPrefs) => Promise<void>;
  /** LWW-merge a server-side prefs row into the local store. */
  applyServerPrefs: (row: PrefsSyncRow) => Promise<void>;
  /** Snapshot for the sync engine. */
  getPrefsForSync: () => PrefsSyncRow;
}

export const usePrefsStore = create<PrefsState>()(
  devtools(
    (set, get) => ({
      weightUnit: 'kg',
      autoAdvanceCycle: true,
      defaultRestSeconds: DEFAULT_REST_SECONDS,
      updatedAt: 0,
      isLoaded: false,

      loadPrefs: async () => {
        try {
          const [weightRaw, autoAdvanceRaw, restRaw, updatedAt] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT),
            AsyncStorage.getItem(STORAGE_KEYS.AUTO_ADVANCE_CYCLE),
            AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_REST_SECONDS),
            readUpdatedAt(),
          ]);
          set({
            weightUnit: weightRaw === 'lbs' ? 'lbs' : 'kg',
            autoAdvanceCycle: autoAdvanceRaw !== 'false',
            defaultRestSeconds: parseRestSeconds(restRaw),
            updatedAt,
            isLoaded: true,
          });
        } catch {
          set({ isLoaded: true });
        }
      },

      setWeightUnit: async (unit) => {
        const now = Date.now();
        set({ weightUnit: unit, updatedAt: now });
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_UNIT, unit);
          await writeUpdatedAt(now);
        } catch {
          // ignore
        }
      },

      setAutoAdvanceCycle: async (value) => {
        const now = Date.now();
        set({ autoAdvanceCycle: value, updatedAt: now });
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.AUTO_ADVANCE_CYCLE, value ? 'true' : 'false');
          await writeUpdatedAt(now);
        } catch {
          // ignore
        }
      },

      setDefaultRestSeconds: async (seconds) => {
        const normalized = normalizeRestSeconds(seconds);
        const now = Date.now();
        set({ defaultRestSeconds: normalized, updatedAt: now });
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_REST_SECONDS, String(normalized));
          await writeUpdatedAt(now);
        } catch {
          // ignore
        }
      },

      importPrefs: async (prefs) => {
        const weightUnit: WeightUnit = prefs.weightUnit === 'lbs' ? 'lbs' : 'kg';
        const autoAdvanceCycle = prefs.autoAdvanceCycle;
        const defaultRestSeconds = normalizeRestSeconds(prefs.defaultRestSeconds);
        const now = Date.now();

        set({ weightUnit, autoAdvanceCycle, defaultRestSeconds, updatedAt: now });
        try {
          await Promise.all([
            AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_UNIT, weightUnit),
            AsyncStorage.setItem(
              STORAGE_KEYS.AUTO_ADVANCE_CYCLE,
              autoAdvanceCycle ? 'true' : 'false',
            ),
            AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_REST_SECONDS, String(defaultRestSeconds)),
            writeUpdatedAt(now),
          ]);
        } catch (err) {
          throw new Error(`Failed to import preferences: ${String(err)}`);
        }
      },

      applyServerPrefs: async (row) => {
        const { updatedAt } = get();
        if (row.updatedAt <= updatedAt) return;
        set({
          weightUnit: row.weightUnit,
          autoAdvanceCycle: row.autoAdvanceCycle,
          defaultRestSeconds: row.defaultRestSeconds,
          updatedAt: row.updatedAt,
        });
        try {
          await Promise.all([
            AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_UNIT, row.weightUnit),
            AsyncStorage.setItem(
              STORAGE_KEYS.AUTO_ADVANCE_CYCLE,
              row.autoAdvanceCycle ? 'true' : 'false',
            ),
            AsyncStorage.setItem(
              STORAGE_KEYS.DEFAULT_REST_SECONDS,
              String(row.defaultRestSeconds),
            ),
            writeUpdatedAt(row.updatedAt),
          ]);
        } catch {
          // ignore
        }
      },

      getPrefsForSync: () => {
        const s = get();
        return {
          weightUnit: s.weightUnit,
          autoAdvanceCycle: s.autoAdvanceCycle,
          defaultRestSeconds: s.defaultRestSeconds,
          updatedAt: s.updatedAt,
        };
      },
    }),
    { name: 'PrefsStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
