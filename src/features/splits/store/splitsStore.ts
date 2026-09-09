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

/**
 * Split and Exercise rows written before phase 3 lack `updatedAt`. Backfill
 * from `createdAt` for splits and from `now()` for exercises (they had no
 * timestamp of any kind). This runs once at load time — the value is then
 * persisted alongside the rest of the row on the next save.
 */
function migrateSplit(split: Split): Split {
  if (typeof split.updatedAt === 'number') return split;
  return { ...split, updatedAt: split.createdAt };
}

function migrateExercise(exercise: Exercise): Exercise {
  if (typeof exercise.updatedAt === 'number') return exercise;
  return { ...exercise, updatedAt: Date.now() };
}

function isTombstone<T extends { deletedAt?: number | null }>(row: T): boolean {
  return row.deletedAt != null;
}

interface SplitsState {
  splits: Split[];
  exercises: Exercise[];
  /**
   * Soft-deleted rows kept on device until the sync layer confirms the
   * server accepted the tombstone. Never rendered.
   */
  splitTombstones: Split[];
  exerciseTombstones: Exercise[];
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
  /**
   * Merge server-side rows into the local state using last-write-wins.
   * Called by the sync engine after a pull.
   */
  applyServerSplits: (rows: Split[]) => Promise<void>;
  applyServerExercises: (rows: Exercise[]) => Promise<void>;
  /** All splits/exercises including tombstones — used by the sync engine. */
  getAllSplitRowsForSync: () => Split[];
  getAllExerciseRowsForSync: () => Exercise[];
}

export const useSplitsStore = create<SplitsState>()(
  devtools(
    (set, get) => ({
  splits: [],
  exercises: [],
  splitTombstones: [],
  exerciseTombstones: [],
  isLoaded: false,
  error: null,

  loadData: async () => {
    try {
      const [rawSplits, rawExercises] = await Promise.all([getSplits(), getExercises()]);
      const migratedSplits = rawSplits.map(migrateSplit);
      const migratedExercises = rawExercises.map(migrateExercise);
      set({
        splits: migratedSplits.filter((s) => !isTombstone(s)),
        splitTombstones: migratedSplits.filter(isTombstone),
        exercises: migratedExercises.filter((e) => !isTombstone(e)),
        exerciseTombstones: migratedExercises.filter(isTombstone),
        isLoaded: true,
        error: null,
      });
    } catch (err) {
      set({ error: String(err), isLoaded: true });
    }
  },

  createSplit: async (name) => {
    const now = Date.now();
    const split: Split = {
      id: generateId(),
      name,
      exerciseIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const splits = [...get().splits, split];
    set({ splits });
    await saveSplits([...splits, ...get().splitTombstones]);
    return split;
  },

  renameSplit: async (id, name) => {
    const now = Date.now();
    const splits = get().splits.map((s) => (s.id === id ? { ...s, name, updatedAt: now } : s));
    set({ splits });
    await saveSplits([...splits, ...get().splitTombstones]);
  },

  deleteSplit: async (id) => {
    const { splits, exercises, splitTombstones, exerciseTombstones } = get();

    // Find exercises that belong exclusively to this split — they get
    // tombstoned along with the split so a delete on one device wipes
    // the orphaned exercises on the other device too.
    const otherSplits = splits.filter((s) => s.id !== id);
    const usedElsewhere = new Set(otherSplits.flatMap((s) => s.exerciseIds));
    const toDelete = splits.find((s) => s.id === id);
    if (!toDelete) return;
    const exclusiveIds = new Set(
      (toDelete.exerciseIds ?? []).filter((eid) => !usedElsewhere.has(eid)),
    );

    const now = Date.now();
    const splitTombstone: Split = { ...toDelete, deletedAt: now, updatedAt: now };
    const nextSplits = otherSplits;
    const nextSplitTombstones = [...splitTombstones, splitTombstone];

    const nextExerciseTombstones = [...exerciseTombstones];
    const nextExercises = exercises.filter((e) => {
      if (!exclusiveIds.has(e.id)) return true;
      nextExerciseTombstones.push({ ...e, deletedAt: now, updatedAt: now });
      return false;
    });

    set({
      splits: nextSplits,
      splitTombstones: nextSplitTombstones,
      exercises: nextExercises,
      exerciseTombstones: nextExerciseTombstones,
    });
    await saveSplits([...nextSplits, ...nextSplitTombstones]);
    await saveExercises([...nextExercises, ...nextExerciseTombstones]);

    // Convert cycle days referencing this split to rest days. The cycle
    // is a singleton so this is a straight update — the cycleStore
    // subscription will pick up the new updatedAt and sync it.
    const cycle = await getWorkoutCycle();
    if (cycle) {
      const updatedDays = cycle.days.map((day) =>
        day.type === 'split' && day.splitId === id
          ? { ...day, type: 'rest' as const, splitId: undefined }
          : day,
      );
      await saveWorkoutCycle({ ...cycle, days: updatedDays, updatedAt: now });
      const { useCycleStore } = await import('./cycleStore');
      useCycleStore.getState().loadCycle();
    }
  },

  reorderSplits: async (splits) => {
    const now = Date.now();
    const stamped = splits.map((s) => ({ ...s, updatedAt: now }));
    set({ splits: stamped });
    await saveSplits([...stamped, ...get().splitTombstones]);
  },

  createExercise: async (name, attrs) => {
    const trimmed = name.trim();
    const now = Date.now();
    const exercise = applyExerciseAttributes(
      { id: generateId(), name: trimmed, updatedAt: now },
      attrs,
    );
    const exercises = [...get().exercises, exercise];
    set({ exercises });
    await saveExercises([...exercises, ...get().exerciseTombstones]);
    return exercise;
  },

  updateExercise: async (id, patch) => {
    const { name, ...attrs } = patch;
    const now = Date.now();
    const exercises = get().exercises.map((e) => {
      if (e.id !== id) return e;
      const withName =
        name !== undefined ? { ...e, name: name.trim() || e.name } : e;
      return { ...applyExerciseAttributes(withName, attrs), updatedAt: now };
    });
    set({ exercises });
    await saveExercises([...exercises, ...get().exerciseTombstones]);
  },

  addExerciseToSplit: async (splitId, exerciseId) => {
    const now = Date.now();
    const splits = get().splits.map((s) =>
      s.id === splitId
        ? { ...s, exerciseIds: [...s.exerciseIds, exerciseId], updatedAt: now }
        : s,
    );
    set({ splits });
    await saveSplits([...splits, ...get().splitTombstones]);
  },

  removeExerciseFromSplit: async (splitId, exerciseId) => {
    const now = Date.now();
    const splits = get().splits.map((s) =>
      s.id === splitId
        ? { ...s, exerciseIds: s.exerciseIds.filter((id) => id !== exerciseId), updatedAt: now }
        : s,
    );
    set({ splits });
    await saveSplits([...splits, ...get().splitTombstones]);
  },

  reorderExercises: async (splitId, exerciseIds) => {
    const now = Date.now();
    const splits = get().splits.map((s) =>
      s.id === splitId ? { ...s, exerciseIds, updatedAt: now } : s,
    );
    set({ splits });
    await saveSplits([...splits, ...get().splitTombstones]);
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

  applyServerSplits: async (rows) => {
    const { splits, splitTombstones } = get();
    const byId = new Map<string, Split>();
    for (const s of splits) byId.set(s.id, s);
    for (const t of splitTombstones) byId.set(t.id, t);

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
      splits: merged.filter((s) => !isTombstone(s)),
      splitTombstones: merged.filter(isTombstone),
    });
    await saveSplits(merged);
  },

  applyServerExercises: async (rows) => {
    const { exercises, exerciseTombstones } = get();
    const byId = new Map<string, Exercise>();
    for (const e of exercises) byId.set(e.id, e);
    for (const t of exerciseTombstones) byId.set(t.id, t);

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
      exercises: merged.filter((e) => !isTombstone(e)),
      exerciseTombstones: merged.filter(isTombstone),
    });
    await saveExercises(merged);
  },

  getAllSplitRowsForSync: () => [...get().splits, ...get().splitTombstones],
  getAllExerciseRowsForSync: () => [...get().exercises, ...get().exerciseTombstones],
    }),
    { name: 'SplitsStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
