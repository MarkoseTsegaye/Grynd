export interface PlateLoad {
  unit: 'kg' | 'lbs';
  perSide: Record<number, number>;
}

export type SetSide = 'left' | 'right';

export interface LoggedSet {
  reps: number;
  weightKg: number;
  plates?: PlateLoad;
  side?: SetSide;
  effort?: {
    toFailure: boolean;
    /**
     * Legacy field. Sets logged before the RIR switch stored perceived
     * exertion; read them through `getSetRir` rather than directly.
     */
    rpe?: number;
    /** Reps in reserve — what the pad logs now. 0 = nothing left in the tank. */
    rir?: number;
  };
  notes?: string;
  loggedAt: number;
}

export interface LoggedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: LoggedSet[];
  firstLoggedAt?: number;
  substitutedForExerciseId?: string;
  substitutedForExerciseName?: string;
  unilateral?: boolean;
  plateLoaded?: boolean;
}

export interface WorkoutSession {
  id: string;
  splitId: string;
  splitName: string;
  startedAt: number;
  completedAt: number | null;
  exercises: LoggedExercise[];
  currentExerciseIndex?: number;
  pausedAt?: number;
}
