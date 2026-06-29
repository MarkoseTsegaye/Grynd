import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getActiveSession, setActiveSession, clearActiveSession, saveSession } from '../../../storage/adapters/sessions';
import { useCycleStore } from '../../splits/store/cycleStore';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { generateId } from '../../../shared/lib/id';
import { sortExercisesByPerformedOrder } from '../lib/sortExercisesByPerformedOrder';
import type { WorkoutSession, LoggedExercise, LoggedSet } from '../types';
import type { Split, Exercise } from '../../splits/types';

interface WorkoutState {
  session: WorkoutSession | null;
  currentExerciseIndex: number;
  isLoaded: boolean;
  error: string | null;
  loadActiveSession: () => Promise<void>;
  startWorkout: (split: Split, exercises: Exercise[]) => Promise<void>;
  logSet: (
    exerciseId: string,
    reps: number,
    weightKg: number,
    effort?: { toFailure: boolean; rpe?: number },
    notes?: string,
    plates?: LoggedSet['plates'],
  ) => Promise<void>;
  deleteSet: (exerciseId: string, setIndex: number) => Promise<void>;
  goToExercise: (index: number) => void;
  substituteExercise: (index: number, substituteName: string) => Promise<void>;
  finishWorkout: (completedAt?: number) => Promise<void>;
  abandonWorkout: () => Promise<void>;
  leaveWorkout: () => Promise<void>;
  resumeWorkoutEntry: (splitId: string) => Promise<void>;
}

export const useWorkoutStore = create<WorkoutState>()(
  devtools(
    (set, get) => ({
      session: null,
      currentExerciseIndex: 0,
      isLoaded: false,
      error: null,

      loadActiveSession: async () => {
        try {
          const stored = await getActiveSession();
          const current = get().session;
          if (current && !stored) {
            set({ isLoaded: true, error: null });
            return;
          }
          let currentExerciseIndex = stored?.currentExerciseIndex ?? 0;
          if (stored && stored.exercises.length > 0) {
            currentExerciseIndex = Math.max(
              0,
              Math.min(currentExerciseIndex, stored.exercises.length - 1),
            );
          }
          const session =
            stored !== null ? { ...stored, currentExerciseIndex } : null;
          set({ session, currentExerciseIndex, isLoaded: true, error: null });
        } catch (err) {
          set({ error: String(err), isLoaded: true });
        }
      },

      startWorkout: async (split, exercises) => {
        const loggedExercises: LoggedExercise[] = exercises.map((e) => ({
          exerciseId: e.id,
          exerciseName: e.name,
          sets: [],
        }));
        const session: WorkoutSession = {
          id: generateId(),
          splitId: split.id,
          splitName: split.name,
          startedAt: Date.now(),
          completedAt: null,
          exercises: loggedExercises,
          currentExerciseIndex: 0,
        };
        set({ session, currentExerciseIndex: 0, error: null });
        try {
          await setActiveSession(session);
        } catch (err) {
          set({ session: null, currentExerciseIndex: 0, error: String(err) });
          throw err;
        }
      },

      logSet: async (exerciseId, reps, weightKg, effort, notes, plates) => {
        const { session } = get();
        if (!session) return;

        const newSet: LoggedSet = {
          reps,
          weightKg,
          ...(plates ? { plates } : {}),
          ...(effort ? { effort } : {}),
          ...(notes ? { notes } : {}),
          loggedAt: Date.now(),
        };
        const exercises = session.exercises.map((e) =>
          e.exerciseId === exerciseId
            ? {
                ...e,
                sets: [...e.sets, newSet],
                ...(e.sets.length === 0 ? { firstLoggedAt: newSet.loggedAt } : {}),
              }
            : e,
        );
        const updated = { ...session, exercises, currentExerciseIndex: get().currentExerciseIndex };
        set({ session: updated });
        await setActiveSession(updated);
      },

      deleteSet: async (exerciseId, setIndex) => {
        const { session } = get();
        if (!session) return;

        const exercises = session.exercises.map((e) => {
          if (e.exerciseId !== exerciseId) return e;

          const sets = e.sets.filter((_, i) => i !== setIndex);
          if (sets.length === 0) {
            const { firstLoggedAt: _, ...rest } = e;
            return { ...rest, sets };
          }
          return { ...e, sets };
        });
        const updated = { ...session, exercises, currentExerciseIndex: get().currentExerciseIndex };
        set({ session: updated });
        await setActiveSession(updated);
      },

      goToExercise: (index) => {
        const { session } = get();
        if (!session) {
          set({ currentExerciseIndex: index });
          return;
        }
        const clamped = Math.max(0, Math.min(index, session.exercises.length - 1));
        const updated = { ...session, currentExerciseIndex: clamped };
        set({ session: updated, currentExerciseIndex: clamped });
        void setActiveSession(updated);
      },

      substituteExercise: async (index, substituteName) => {
        const trimmed = substituteName.trim();
        if (!trimmed) return;

        const { session } = get();
        if (!session || index < 0 || index >= session.exercises.length) return;

        const current = session.exercises[index];
        const plannedId = current.substitutedForExerciseId ?? current.exerciseId;
        const plannedName = current.substitutedForExerciseName ?? current.exerciseName;

        const substitute: LoggedExercise = {
          exerciseId: generateId(),
          exerciseName: trimmed,
          sets: [],
          substitutedForExerciseId: plannedId,
          substitutedForExerciseName: plannedName,
        };

        const exercises = session.exercises.map((e, i) => (i === index ? substitute : e));
        const updated = { ...session, exercises, currentExerciseIndex: get().currentExerciseIndex };
        set({ session: updated });
        await setActiveSession(updated);
      },

      finishWorkout: async (completedAt?: number) => {
        const { session } = get();
        if (!session) return;

        const completed = {
          ...session,
          completedAt: completedAt ?? Date.now(),
          exercises: sortExercisesByPerformedOrder(session.exercises),
        };
        // BUG-01 fix: ensure write completes before navigation
        await saveSession(completed);
        await clearActiveSession();
        if (usePrefsStore.getState().autoAdvanceCycle) {
          await useCycleStore.getState().advanceCycle();
        }
        set({ session: null, currentExerciseIndex: 0 });
      },

      abandonWorkout: async () => {
        await clearActiveSession();
        set({ session: null, currentExerciseIndex: 0 });
      },

      leaveWorkout: async () => {
        const { session, currentExerciseIndex } = get();
        if (!session) return;

        const updated = { ...session, currentExerciseIndex, pausedAt: Date.now() };
        set({ session: updated });
        await setActiveSession(updated);
      },

      resumeWorkoutEntry: async (splitId) => {
        const { session, currentExerciseIndex } = get();
        if (!session || session.splitId !== splitId || session.completedAt !== null) return;

        const { pausedAt: _, ...rest } = session;
        const updated = { ...rest, currentExerciseIndex };
        set({ session: updated });
        await setActiveSession(updated);
      },
    }),
    { name: 'WorkoutStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
