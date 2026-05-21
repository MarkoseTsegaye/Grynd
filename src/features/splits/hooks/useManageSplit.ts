import { useEffect, useState } from 'react';
import { useSplitsStore } from '../store/splitsStore';
import { useHaptics } from '../../../shared/hooks/useHaptics';

export function useManageSplit(splitId: string) {
  const {
    isLoaded, loadData, getSplitById, getExercisesForSplit,
    createExercise, addExerciseToSplit, removeExerciseFromSplit,
    renameSplit,
  } = useSplitsStore();
  const { impact, success } = useHaptics();

  const [newExerciseName, setNewExerciseName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) loadData();
  }, [isLoaded, loadData]);

  const split = getSplitById(splitId);
  const exercises = getExercisesForSplit(splitId);

  const handleAddExercise = async () => {
    const trimmed = newExerciseName.trim();
    if (!trimmed) return;
    setIsAdding(true);
    setError(null);
    try {
      const exercise = await createExercise(trimmed);
      await addExerciseToSplit(splitId, exercise.id);
      setNewExerciseName('');
      success();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveExercise = async (exerciseId: string) => {
    impact();
    await removeExerciseFromSplit(splitId, exerciseId);
  };

  const handleRenameSplit = async (name: string) => {
    if (!name.trim()) return;
    await renameSplit(splitId, name.trim());
  };

  return {
    split, exercises, newExerciseName, setNewExerciseName,
    isAdding, error, handleAddExercise, handleRemoveExercise, handleRenameSplit,
  };
}
