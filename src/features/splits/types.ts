export interface Split {
  id: string;
  name: string;
  exerciseIds: string[];
  createdAt: number;
  /**
   * ms of the last mutation touching this row. Sync layer uses it to
   * resolve conflicts (LWW). Backfilled from `createdAt` for rows
   * written before phase 3.
   */
  updatedAt: number;
  /** ms of a soft delete, or null/undefined for live rows. */
  deletedAt?: number | null;
}

export interface Exercise {
  id: string;
  name: string;
  notes?: string;
  /** When true, set logging asks for Left / Right. Omitted/false = regular. */
  unilateral?: boolean;
  /** When true, log sheet opens in plate mode. Omitted/false = regular. */
  plateLoaded?: boolean;
  /** ms of the last mutation touching this row (see Split.updatedAt). */
  updatedAt: number;
  /** ms of a soft delete, or null/undefined for live rows. */
  deletedAt?: number | null;
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
  /**
   * ms of the last mutation to the cycle. This is a singleton row per
   * user on the server; LWW compares this field. Backfilled from
   * `lastAdvancedAt` or Date.now() for pre-phase-3 rows.
   */
  updatedAt: number;
}
