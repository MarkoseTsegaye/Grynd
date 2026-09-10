import { useEffect, useMemo } from 'react';
import { useSplitsStore } from '../../splits';
import { useHistory } from '../../history';
import { rankExerciseMomentum, type ExerciseMomentum } from '../lib/exerciseMomentum';

export interface ExerciseMomentumState extends ExerciseMomentum {
  isLoaded: boolean;
  /** True when every bucket is empty — the caller shows one nudge instead of three headers. */
  isEmpty: boolean;
}

export function useExerciseMomentum(): ExerciseMomentumState {
  const exercises = useSplitsStore((s) => s.exercises);
  const splitsLoaded = useSplitsStore((s) => s.isLoaded);
  const loadData = useSplitsStore((s) => s.loadData);
  const { sessions, isLoaded: historyLoaded } = useHistory();

  // useHistory self-loads; the splits store does not, and Trends no
  // longer routes through useExerciseProgress, which used to do it.
  useEffect(() => {
    if (!splitsLoaded) void loadData();
  }, [splitsLoaded, loadData]);

  return useMemo(() => {
    const isLoaded = splitsLoaded && historyLoaded;
    if (!isLoaded) {
      return { rising: [], stalled: [], prs: [], isLoaded: false, isEmpty: true };
    }

    const ranked = rankExerciseMomentum({ exercises, sessions });
    return {
      ...ranked,
      isLoaded: true,
      isEmpty:
        ranked.rising.length === 0 && ranked.stalled.length === 0 && ranked.prs.length === 0,
    };
  }, [exercises, sessions, splitsLoaded, historyLoaded]);
}
