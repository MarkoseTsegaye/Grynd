import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  getWeightEntries,
  saveWeightEntries,
} from '../../../storage/adapters/weight';
import { generateId } from '../../../shared/lib/id';
import type { WeightEntry } from '../types';

interface WeightState {
  /** Visible entries (deletedAt is null/undefined). */
  entries: WeightEntry[];
  /**
   * Soft-deleted rows kept locally until the sync layer confirms the server
   * has the tombstone. Never rendered. On first launch this is always empty.
   */
  tombstones: WeightEntry[];
  isLoaded: boolean;
  error: string | null;
  loadEntries: () => Promise<void>;
  upsertEntry: (input: { dateKey: string; weightLbs: number }) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  /**
   * Merge server-side rows into the local state using last-write-wins
   * (compare `updatedAt`). Called by the sync engine after a pull. Also
   * clears matching tombstones once the server has echoed them back.
   */
  applyServerRows: (rows: WeightEntry[]) => Promise<void>;
  /**
   * All rows including tombstones — the sync engine reads this to seed the
   * server on the first push after sign-in. Never used by the UI.
   */
  getAllRowsForSync: () => WeightEntry[];
}

function isTombstone(entry: WeightEntry): boolean {
  return entry.deletedAt != null;
}

/**
 * Older on-device rows lack `updatedAt` (added in the sync-layer rollout).
 * Backfill from `loggedAt` so downstream code can rely on the field.
 */
function migrateRow(entry: WeightEntry): WeightEntry {
  if (typeof entry.updatedAt === 'number') return entry;
  return { ...entry, updatedAt: entry.loggedAt };
}

export const useWeightStore = create<WeightState>()(
  devtools(
    (set, get) => ({
      entries: [],
      tombstones: [],
      isLoaded: false,
      error: null,

      loadEntries: async () => {
        try {
          const raw = (await getWeightEntries()).map(migrateRow);
          set({
            entries: raw.filter((e) => !isTombstone(e)),
            tombstones: raw.filter(isTombstone),
            isLoaded: true,
            error: null,
          });
        } catch (err) {
          set({ error: String(err), isLoaded: true });
        }
      },

      upsertEntry: async ({ dateKey, weightLbs }) => {
        const { entries, tombstones } = get();
        const existing = entries.find((e) => e.dateKey === dateKey);
        const now = Date.now();

        const nextEntry: WeightEntry = existing
          ? { ...existing, weightLbs, loggedAt: now, updatedAt: now, deletedAt: null }
          : {
              id: generateId(),
              dateKey,
              loggedAt: now,
              weightLbs,
              updatedAt: now,
            };

        const nextEntries = existing
          ? entries.map((e) => (e.dateKey === dateKey ? nextEntry : e))
          : [...entries, nextEntry];

        set({ entries: nextEntries });
        await saveWeightEntries([...nextEntries, ...tombstones]);
      },

      deleteEntry: async (id) => {
        const { entries, tombstones } = get();
        const target = entries.find((e) => e.id === id);
        if (!target) return;

        const now = Date.now();
        const tombstone: WeightEntry = { ...target, deletedAt: now, updatedAt: now };
        const nextEntries = entries.filter((e) => e.id !== id);
        const nextTombstones = [...tombstones, tombstone];

        set({ entries: nextEntries, tombstones: nextTombstones });
        await saveWeightEntries([...nextEntries, ...nextTombstones]);
      },

      applyServerRows: async (rows) => {
        const { entries, tombstones } = get();

        // Index existing rows by id for O(1) LWW compare. Tombstones and
        // visible entries share the id namespace, so one map covers both.
        const byId = new Map<string, WeightEntry>();
        for (const e of entries) byId.set(e.id, e);
        for (const t of tombstones) byId.set(t.id, t);

        let touched = false;
        for (const incoming of rows) {
          const local = byId.get(incoming.id);
          if (!local || incoming.updatedAt > local.updatedAt) {
            byId.set(incoming.id, incoming);
            touched = true;
          }
        }
        if (!touched) return;

        const merged = Array.from(byId.values());
        set({
          entries: merged.filter((e) => !isTombstone(e)),
          tombstones: merged.filter(isTombstone),
        });
        await saveWeightEntries(merged);
      },

      getAllRowsForSync: () => {
        const { entries, tombstones } = get();
        return [...entries, ...tombstones];
      },
    }),
    { name: 'WeightStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
