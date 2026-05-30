import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getActiveSession, setActiveSession, clearActiveSession, saveSession } from '../../../storage/adapters/sessions';
import { useCycleStore } from '../../splits/store/cycleStore';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { generateId } from '../../../shared/lib/id';
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
  ) => Promise<void>;
  deleteSet: (exerciseId: string, setIndex: number) => Promise<void>;
  goToExercise: (index: number) => void;
  finishWorkout: () => Promise<void>;
  abandonWorkout: () => Promise<void>;
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
          set({ session: stored, isLoaded: true, error: null });
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
        };
        set({ session, currentExerciseIndex: 0, error: null });
        try {
          await setActiveSession(session);
        } catch (err) {
          set({ session: null, currentExerciseIndex: 0, error: String(err) });
          throw err;
        }
      },

      logSet: async (exerciseId, reps, weightKg, effort, notes) => {
        const { session } = get();
        if (!session) return;

        const newSet: LoggedSet = {
          reps,
          weightKg,
          ...(effort ? { effort } : {}),
          ...(notes ? { notes } : {}),
          loggedAt: Date.now(),
        };
        const exercises = session.exercises.map((e) =>
          e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e,
        );
        const updated = { ...session, exercises };
        set({ session: updated });
        await setActiveSession(updated);
      },

      deleteSet: async (exerciseId, setIndex) => {
        const { session } = get();
        if (!session) return;

        const exercises = session.exercises.map((e) =>
          e.exerciseId === exerciseId
            ? { ...e, sets: e.sets.filter((_, i) => i !== setIndex) }
            : e,
        );
        const updated = { ...session, exercises };
        set({ session: updated });
        await setActiveSession(updated);
      },

      goToExercise: (index) => {
        set({ currentExerciseIndex: index });
      },

      finishWorkout: async () => {
        const { session } = get();
        if (!session) return;

        const completed = { ...session, completedAt: Date.now() };
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
    }),
    { name: 'WorkoutStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
