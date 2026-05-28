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
        const updated: WorkoutCycle = {
          ...cycle,
          currentIndex: (cycle.currentIndex + 1) % cycle.days.length,
          lastAdvancedAt: Date.now(),
        };
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      reorderDays: async (days) => {
        const { cycle } = get();
        const updated: WorkoutCycle = cycle
          ? { ...cycle, days }
          : { days, currentIndex: 0, lastAdvancedAt: null };
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      addSplitDay: async (splitId) => {
        const { cycle } = get();
        const newDay: CycleDay = { id: generateId(), type: 'split', splitId };
        const updated: WorkoutCycle = cycle
          ? { ...cycle, days: [...cycle.days, newDay] }
          : { days: [newDay], currentIndex: 0, lastAdvancedAt: null };
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      addRestDay: async () => {
        const { cycle } = get();
        const newDay: CycleDay = { id: generateId(), type: 'rest' };
        const updated: WorkoutCycle = cycle
          ? { ...cycle, days: [...cycle.days, newDay] }
          : { days: [newDay], currentIndex: 0, lastAdvancedAt: null };
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      removeDay: async (dayId) => {
        const { cycle } = get();
        if (!cycle) return;
        const days = cycle.days.filter((d) => d.id !== dayId);
        const currentIndex = Math.min(cycle.currentIndex, Math.max(0, days.length - 1));
        const updated: WorkoutCycle = { ...cycle, days, currentIndex };
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },

      resetCyclePosition: async () => {
        const { cycle } = get();
        if (!cycle || cycle.days.length === 0) return;
        const updated: WorkoutCycle = { ...cycle, currentIndex: 0 };
        set({ cycle: updated });
        await saveWorkoutCycle(updated);
      },
    }),
    { name: 'CycleStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
