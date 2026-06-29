export interface PlateLoad {
  unit: 'kg' | 'lbs';
  perSide: Record<number, number>;
}

export interface LoggedSet {
  reps: number;
  weightKg: number;
  plates?: PlateLoad;
  effort?: {
    toFailure: boolean;
    rpe?: number;
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
