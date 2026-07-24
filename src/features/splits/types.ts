export interface Split {
  id: string;
  name: string;
  exerciseIds: string[];
  createdAt: number;
}

export interface Exercise {
  id: string;
  name: string;
  notes?: string;
  /** When true, set logging asks for Left / Right. Omitted/false = regular. */
  unilateral?: boolean;
  /** When true, log sheet opens in plate mode. Omitted/false = regular. */
  plateLoaded?: boolean;
}

export type ExerciseAttributes = {
  notes?: string | null;
  unilateral?: boolean | null;
  plateLoaded?: boolean | null;
};

export interface CycleDay {
  id: string;
  type: 'split' | 'rest';
  splitId?: string;
}

export interface WorkoutCycle {
  days: CycleDay[];
  currentIndex: number;
  lastAdvancedAt: number | null;
}
