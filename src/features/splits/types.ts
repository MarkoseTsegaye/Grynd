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
}

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
