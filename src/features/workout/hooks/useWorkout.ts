import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useWorkoutStore } from '../store/workoutStore';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { useHaptics } from '../../../shared/hooks/useHaptics';
import { getPreviousPerformance } from '../../../storage/adapters/sessions';
import {
  computePlateWeightKg,
  lbsToKg,
  LBS_PLATES,
  KG_PLATES,
} from '../../../shared/lib/weight';
import type { LoggedExercise } from '../types';

type WeightMode = 'straight' | 'plates';

export function useWorkout(logSheetRef: RefObject<BottomSheetModal | null>) {
  const { session, currentExerciseIndex, logSet, deleteSet, goToExercise, finishWorkout } =
    useWorkoutStore();
  const { weightUnit, loadPrefs, isLoaded: prefsLoaded, setWeightUnit } = usePrefsStore();
  const { impact, light, success } = useHaptics();

  const [logSheetVisible, setLogSheetVisible] = useState(false);
  const [repInput, setRepInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [weightMode, setWeightMode] = useState<WeightMode>('straight');
  const [plates, setPlates] = useState<Record<number, number>>({});
  const [toFailure, setToFailure] = useState(false);
  const [rpeInput, setRpeInput] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  const [previousPerformances, setPreviousPerformances] = useState<
    Record<string, LoggedExercise | null>
  >({});
  const fetchedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!prefsLoaded) loadPrefs();
  }, [prefsLoaded, loadPrefs]);

  const currentExercise = session?.exercises[currentExerciseIndex] ?? null;
  const totalExercises = session?.exercises.length ?? 0;
  const isLastExercise = currentExerciseIndex === totalExercises - 1;

  // Lazy-load previous performance for the current exercise
  useEffect(() => {
    if (!currentExercise || !session) return;
    const { exerciseId } = currentExercise;
    if (fetchedIds.current.has(exerciseId)) return;
    fetchedIds.current.add(exerciseId);
    getPreviousPerformance(exerciseId, session.id).then((result) => {
      setPreviousPerformances((prev) => ({ ...prev, [exerciseId]: result }));
    });
  }, [currentExercise?.exerciseId, session?.id]);

  const currentPreviousPerformance = currentExercise
    ? (previousPerformances[currentExercise.exerciseId] ?? null)
    : null;

  const plateList = weightUnit === 'lbs' ? LBS_PLATES : KG_PLATES;

  const computedWeightKg: number = weightMode === 'plates'
    ? computePlateWeightKg(plates, weightUnit)
    : weightUnit === 'lbs'
      ? lbsToKg(parseFloat(weightInput) || 0)
      : parseFloat(weightInput) || 0;

  const resetLogForm = useCallback(() => {
    setRepInput('');
    setWeightInput('');
    setPlates({});
    setToFailure(false);
    setRpeInput('');
  }, []);

  const openLogSheet = useCallback(() => {
    resetLogForm();
    logSheetRef.current?.present();
  }, [logSheetRef, resetLogForm]);

  const closeLogSheet = useCallback(() => {
    logSheetRef.current?.dismiss();
    setLogSheetVisible(false);
    resetLogForm();
  }, [logSheetRef, resetLogForm]);

  const handleLogSheetChange = useCallback((index: number) => {
    setLogSheetVisible(index >= 0);
  }, []);

  const handleConfirmSet = useCallback(async () => {
    const reps = parseInt(repInput, 10);
    if (!currentExercise || isNaN(reps) || reps <= 0 || computedWeightKg <= 0) return;

    const rpeNum = rpeInput ? Math.min(10, Math.max(1, parseInt(rpeInput, 10))) : undefined;
    const effort =
      toFailure || rpeNum !== undefined
        ? { toFailure, ...(rpeNum !== undefined ? { rpe: rpeNum } : {}) }
        : undefined;

    setIsLogging(true);
    await logSet(currentExercise.exerciseId, reps, computedWeightKg, effort);
    impact();
    setIsLogging(false);
    closeLogSheet();
  }, [repInput, computedWeightKg, currentExercise, toFailure, rpeInput, logSet, impact, closeLogSheet]);

  const handleDeleteSet = useCallback(
    async (setIndex: number) => {
      if (!currentExercise) return;
      light();
      await deleteSet(currentExercise.exerciseId, setIndex);
    },
    [currentExercise, deleteSet, light],
  );

  const handleSwipeNext = useCallback(() => {
    if (currentExerciseIndex < totalExercises - 1) {
      goToExercise(currentExerciseIndex + 1);
      light();
    }
  }, [currentExerciseIndex, totalExercises, goToExercise, light]);

  const handleSwipePrev = useCallback(() => {
    if (currentExerciseIndex > 0) {
      goToExercise(currentExerciseIndex - 1);
      light();
    }
  }, [currentExerciseIndex, goToExercise, light]);

  const handleFinish = useCallback(async () => {
    success();
    await finishWorkout();
  }, [finishWorkout, success]);

  const toggleWeightMode = useCallback(() => {
    setWeightMode((m) => (m === 'straight' ? 'plates' : 'straight'));
    setWeightInput('');
    setPlates({});
  }, []);

  const addPlate = useCallback((weight: number) => {
    setPlates((prev) => ({ ...prev, [weight]: (prev[weight] ?? 0) + 1 }));
  }, []);

  const removePlate = useCallback((weight: number) => {
    setPlates((prev) => {
      const count = (prev[weight] ?? 0) - 1;
      if (count <= 0) {
        const next = { ...prev };
        delete next[weight];
        return next;
      }
      return { ...prev, [weight]: count };
    });
  }, []);

  const toggleUnit = useCallback(() => {
    const next = weightUnit === 'kg' ? 'lbs' : 'kg';
    setWeightUnit(next);
    setWeightInput('');
    setPlates({});
  }, [weightUnit, setWeightUnit]);

  return {
    session,
    currentExercise,
    currentExerciseIndex,
    totalExercises,
    isLastExercise,
    logSheetVisible,
    repInput,
    setRepInput,
    weightInput,
    setWeightInput,
    weightMode,
    toggleWeightMode,
    weightUnit,
    toggleUnit,
    plates,
    addPlate,
    removePlate,
    plateList,
    computedWeightKg,
    toFailure,
    setToFailure,
    rpeInput,
    setRpeInput,
    isLogging,
    openLogSheet,
    closeLogSheet,
    handleLogSheetChange,
    handleConfirmSet,
    handleDeleteSet,
    handleSwipeNext,
    handleSwipePrev,
    handleFinish,
    currentPreviousPerformance,
  };
}
