import { useEffect, useState } from 'react';
import { useSplitsStore } from '../store/splitsStore';
import { useHaptics } from '../../../shared/hooks/useHaptics';
import type { Exercise } from '../types';

export function useManageSplit(splitId: string) {
  const {
    isLoaded,
    loadData,
    getSplitById,
    getExercisesForSplit,
    createExercise,
    updateExercise,
    addExerciseToSplit,
    removeExerciseFromSplit,
    renameSplit,
  } = useSplitsStore();
  const { impact, success } = useHaptics();

  const [newExerciseName, setNewExerciseName] = useState('');
  const [newUnilateral, setNewUnilateral] = useState(false);
  const [newPlateLoaded, setNewPlateLoaded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

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
      const exercise = await createExercise(trimmed, {
        unilateral: newUnilateral ? true : null,
        plateLoaded: newPlateLoaded ? true : null,
      });
      await addExerciseToSplit(splitId, exercise.id);
      setNewExerciseName('');
      setNewUnilateral(false);
      setNewPlateLoaded(false);
      success();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateExercise = async (patch: {
    name: string;
    unilateral: boolean;
    plateLoaded: boolean;
  }) => {
    if (!editingExercise) return;
    await updateExercise(editingExercise.id, {
      name: patch.name,
      unilateral: patch.unilateral ? true : null,
      plateLoaded: patch.plateLoaded ? true : null,
    });
    success();
    setEditingExercise(null);
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
    split,
    exercises,
    newExerciseName,
    setNewExerciseName,
    newUnilateral,
    setNewUnilateral,
    newPlateLoaded,
    setNewPlateLoaded,
    isAdding,
    error,
    editingExercise,
    setEditingExercise,
    handleAddExercise,
    handleUpdateExercise,
    handleRemoveExercise,
    handleRenameSplit,
  };
}
