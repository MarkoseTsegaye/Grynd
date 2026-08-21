import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  getWeightEntries,
  saveWeightEntries,
} from '../../../storage/adapters/weight';
import { generateId } from '../../../shared/lib/id';
import type { WeightEntry } from '../types';

interface WeightState {
  entries: WeightEntry[];
  isLoaded: boolean;
  error: string | null;
  loadEntries: () => Promise<void>;
  /**
   * Insert or replace the entry for a given `dateKey`. If an entry already
   * exists for that day it is updated in place (keeping the original `id`),
   * otherwise a new one is created. Passing `calories: null` clears any
   * previously-set value; omitting `calories` leaves the existing one
   * untouched.
   */
  upsertEntry: (input: {
    dateKey: string;
    weightLbs: number;
    calories?: number | null;
  }) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

function normalizeCalories(
  next: number | null | undefined,
  previous: number | undefined,
): number | undefined {
  if (next === null) return undefined;
  if (next === undefined) return previous;
  return next;
}

export const useWeightStore = create<WeightState>()(
  devtools(
    (set, get) => ({
      entries: [],
      isLoaded: false,
      error: null,

      loadEntries: async () => {
        try {
          const entries = await getWeightEntries();
          set({ entries, isLoaded: true, error: null });
        } catch (err) {
          set({ error: String(err), isLoaded: true });
        }
      },

      upsertEntry: async ({ dateKey, weightLbs, calories }) => {
        const { entries } = get();
        const existing = entries.find((e) => e.dateKey === dateKey);
        const now = Date.now();

        const nextEntry: WeightEntry = existing
          ? {
              ...existing,
              weightLbs,
              loggedAt: now,
              ...(() => {
                const resolved = normalizeCalories(calories, existing.calories);
                return resolved === undefined ? {} : { calories: resolved };
              })(),
            }
          : {
              id: generateId(),
              dateKey,
              loggedAt: now,
              weightLbs,
              ...(() => {
                const resolved = normalizeCalories(calories, undefined);
                return resolved === undefined ? {} : { calories: resolved };
              })(),
            };

        // Strip the calories field when clearing so serialized shape stays minimal.
        if (existing && calories === null) {
          delete (nextEntry as { calories?: number }).calories;
        }

        const nextEntries = existing
          ? entries.map((e) => (e.dateKey === dateKey ? nextEntry : e))
          : [...entries, nextEntry];

        set({ entries: nextEntries });
        await saveWeightEntries(nextEntries);
      },

      deleteEntry: async (id) => {
        const { entries } = get();
        const nextEntries = entries.filter((e) => e.id !== id);
        if (nextEntries.length === entries.length) return;
        set({ entries: nextEntries });
        await saveWeightEntries(nextEntries);
      },
    }),
    { name: 'WeightStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
