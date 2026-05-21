export interface LoggedSet {
  reps: number;
  weightKg: number;
  effort?: {
    toFailure: boolean;
    rpe?: number;
  };
  loggedAt: number;
}

export interface LoggedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  splitId: string;
  splitName: string;
  startedAt: number;
  completedAt: number | null;
  exercises: LoggedExercise[];
}
