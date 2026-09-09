import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getWorkoutCycle, saveWorkoutCycle } from '../../../storage/adapters/cycle';
import { generateId } from '../../../shared/lib/id';
import type { WorkoutCycle, CycleDay } from '../types';

interface CycleState {
  cycle: WorkoutCycle | null;
  isLoaded: boolean;
  loadCycle: () => Promise<void>;
  advanceCycle: () => Promise<void>;
  reorderDays: (days: CycleDay[]) => Promise<void>;
  addSplitDay: (splitId: string) => Promise<void>;
  addRestDay: () => Promise<void>;
  removeDay: (dayId: string) => Promise<void>;
  resetCyclePosition: () => Promise<void>;
  /**
   * Merge a server-side cycle row into the local state. Because the
   * cycle is a singleton per user, this is a straight LWW compare on
   * `updatedAt` — no per-row merging.
   */
  applyServerCycle: (row: WorkoutCycle) => Promise<void>;
  /** Snapshot the current cycle for the sync engine, or null if none. */
  getCycleForSync: () => WorkoutCycle | null;
}

function stamp(cycle: WorkoutCycle): WorkoutCycle {
  return { ...cycle, updatedAt: Date.now() };
}

export const useCycleStore = create<CycleState>()(
  devtools(
    (set, get) => ({
      cycle: null,
      isLoaded: false,

      loadCycle: async () => {
        const cycle = await getWorkoutCycle();
        set({ cycle, isLoaded: true });
      },

      advanceCycle: async () => {
        const { cycle } = get();
        if (!cycle || cycle.days.length === 0) return;
        const updated = stamp({
          ...cycle,
          currentIndex: (cycle.currentIndex + 1) % cycle.days.length,
          lastAdvancedAt: Date.now(),
        });
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      reorderDays: async (days) => {
        const { cycle } = get();
        const updated: WorkoutCycle = stamp(
          cycle
            ? { ...cycle, days }
            : { days, currentIndex: 0, lastAdvancedAt: null, updatedAt: 0 },
        );
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      addSplitDay: async (splitId) => {
        const { cycle } = get();
        const newDay: CycleDay = { id: generateId(), type: 'split', splitId };
        const updated: WorkoutCycle = stamp(
          cycle
            ? { ...cycle, days: [...cycle.days, newDay] }
            : { days: [newDay], currentIndex: 0, lastAdvancedAt: null, updatedAt: 0 },
        );
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      addRestDay: async () => {
        const { cycle } = get();
        const newDay: CycleDay = { id: generateId(), type: 'rest' };
        const updated: WorkoutCycle = stamp(
          cycle
            ? { ...cycle, days: [...cycle.days, newDay] }
            : { days: [newDay], currentIndex: 0, lastAdvancedAt: null, updatedAt: 0 },
        );
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      removeDay: async (dayId) => {
        const { cycle } = get();
        if (!cycle) return;
        const removedIndex = cycle.days.findIndex((d) => d.id === dayId);
        if (removedIndex === -1) return;
        const days = cycle.days.filter((d) => d.id !== dayId);
        // Keep the pointer on the same logical "today" day: shift left when a
        // day before the current position is removed, then clamp to bounds.
        const shifted =
          removedIndex < cycle.currentIndex ? cycle.currentIndex - 1 : cycle.currentIndex;
        const currentIndex = Math.min(Math.max(0, shifted), Math.max(0, days.length - 1));
        const updated = stamp({ ...cycle, days, currentIndex });
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      resetCyclePosition: async () => {
        const { cycle } = get();
        if (!cycle || cycle.days.length === 0) return;
        const updated = stamp({ ...cycle, currentIndex: 0 });
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      applyServerCycle: async (row) => {
        const { cycle } = get();
        if (cycle && row.updatedAt <= cycle.updatedAt) return;
        set({ cycle: row });
        await saveWorkoutCycle(row);
      },

      getCycleForSync: () => get().cycle,
    }),
    { name: 'CycleStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
