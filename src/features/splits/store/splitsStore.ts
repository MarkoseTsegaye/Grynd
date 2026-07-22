import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getSplits, saveSplits, getExercises, saveExercises } from '../../../storage/adapters/splits';
import { getWorkoutCycle, saveWorkoutCycle } from '../../../storage/adapters/cycle';
import { generateId } from '../../../shared/lib/id';
import type { Split, Exercise, ExerciseAttributes } from '../types';

function applyExerciseAttributes(
  exercise: Exercise,
  attrs?: ExerciseAttributes,
): Exercise {
  if (!attrs) return exercise;
  const next: Exercise = { ...exercise };

  if (attrs.notes !== undefined) {
    if (attrs.notes) next.notes = attrs.notes;
    else delete next.notes;
  }
  if (attrs.unilateral !== undefined) {
    if (attrs.unilateral) next.unilateral = true;
    else delete next.unilateral;
  }
  if (attrs.plateLoaded !== undefined) {
    if (attrs.plateLoaded) next.plateLoaded = true;
    else delete next.plateLoaded;
  }
  return next;
}

interface SplitsState {
  splits: Split[];
  exercises: Exercise[];
  isLoaded: boolean;
  error: string | null;
  loadData: () => Promise<void>;
  createSplit: (name: string) => Promise<Split>;
  renameSplit: (id: string, name: string) => Promise<void>;
  deleteSplit: (id: string) => Promise<void>;
  reorderSplits: (splits: Split[]) => Promise<void>;
  createExercise: (name: string, attrs?: ExerciseAttributes) => Promise<Exercise>;
  updateExercise: (
    id: string,
    patch: { name?: string } & ExerciseAttributes,
  ) => Promise<void>;
  addExerciseToSplit: (splitId: string, exerciseId: string) => Promise<void>;
  removeExerciseFromSplit: (splitId: string, exerciseId: string) => Promise<void>;
  reorderExercises: (splitId: string, exerciseIds: string[]) => Promise<void>;
  getSplitById: (id: string) => Split | undefined;
  getExerciseById: (id: string) => Exercise | undefined;
  getExercisesForSplit: (splitId: string) => Exercise[];
}

export const useSplitsStore = create<SplitsState>()(
  devtools(
    (set, get) => ({
  splits: [],
  exercises: [],
  isLoaded: false,
  error: null,

  loadData: async () => {
    try {
      const [splits, exercises] = await Promise.all([getSplits(), getExercises()]);
      set({ splits, exercises, isLoaded: true, error: null });
    } catch (err) {
      set({ error: String(err), isLoaded: true });
    }
  },

  createSplit: async (name) => {
    const split: Split = { id: generateId(), name, exerciseIds: [], createdAt: Date.now() };
    const splits = [...get().splits, split];
    set({ splits });
    await saveSplits(splits);
    return split;
  },

  renameSplit: async (id, name) => {
    const splits = get().splits.map((s) => (s.id === id ? { ...s, name } : s));
    set({ splits });
    await saveSplits(splits);
  },

  deleteSplit: async (id) => {
    const { splits, exercises } = get();

    // Find exercises that belong exclusively to this split
    const otherSplits = splits.filter((s) => s.id !== id);
    const usedElsewhere = new Set(otherSplits.flatMap((s) => s.exerciseIds));
    const toDelete = splits.find((s) => s.id === id);
    const exclusiveIds = (toDelete?.exerciseIds ?? []).filter((eid) => !usedElsewhere.has(eid));

    const updatedSplits = splits.filter((s) => s.id !== id);
    const updatedExercises = exercises.filter((e) => !exclusiveIds.includes(e.id));
    set({ splits: updatedSplits, exercises: updatedExercises });
    await saveSplits(updatedSplits);
    await saveExercises(updatedExercises);

    // Convert any cycle days referencing this split to rest days
    const cycle = await getWorkoutCycle();
    if (cycle) {
      const updatedDays = cycle.days.map((day) =>
        day.type === 'split' && day.splitId === id
          ? { ...day, type: 'rest' as const, splitId: undefined }
          : day,
      );
      await saveWorkoutCycle({ ...cycle, days: updatedDays });
      // Sync cycle store state
      const { useCycleStore } = await import('./cycleStore');
      useCycleStore.getState().loadCycle();
    }
  },

  reorderSplits: async (splits) => {
    set({ splits });
    await saveSplits(splits);
  },

  createExercise: async (name, attrs) => {
    const trimmed = name.trim();
    const exercise = applyExerciseAttributes(
      { id: generateId(), name: trimmed },
      attrs,
    );
    const exercises = [...get().exercises, exercise];
    set({ exercises });
    await saveExercises(exercises);
    return exercise;
  },

  updateExercise: async (id, patch) => {
    const { name, ...attrs } = patch;
    const exercises = get().exercises.map((e) => {
      if (e.id !== id) return e;
      const withName =
        name !== undefined ? { ...e, name: name.trim() || e.name } : e;
      return applyExerciseAttributes(withName, attrs);
    });
    set({ exercises });
    await saveExercises(exercises);
  },

  addExerciseToSplit: async (splitId, exerciseId) => {
    const splits = get().splits.map((s) =>
      s.id === splitId ? { ...s, exerciseIds: [...s.exerciseIds, exerciseId] } : s,
    );
    set({ splits });
    await saveSplits(splits);
  },

  removeExerciseFromSplit: async (splitId, exerciseId) => {
    const splits = get().splits.map((s) =>
      s.id === splitId ? { ...s, exerciseIds: s.exerciseIds.filter((id) => id !== exerciseId) } : s,
    );
    set({ splits });
    await saveSplits(splits);
  },

  reorderExercises: async (splitId, exerciseIds) => {
    const splits = get().splits.map((s) => (s.id === splitId ? { ...s, exerciseIds } : s));
    set({ splits });
    await saveSplits(splits);
  },

  getSplitById: (id) => get().splits.find((s) => s.id === id),

  getExerciseById: (id) => get().exercises.find((e) => e.id === id),

  getExercisesForSplit: (splitId) => {
    const split = get().splits.find((s) => s.id === splitId);
    if (!split) return [];
    const { exercises } = get();
    return split.exerciseIds
      .map((id) => exercises.find((e) => e.id === id))
      .filter((e): e is Exercise => e !== undefined);
  },
    }),
    { name: 'SplitsStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
