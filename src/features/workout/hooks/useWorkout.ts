import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Alert } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useWorkoutStore } from '../store/workoutStore';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { useHaptics } from '../../../shared/hooks/useHaptics';
import { useRestTimer } from './useRestTimer';
import { getPreviousPerformance } from '../../../storage/adapters/sessions';
import {
  computePlateWeightKg,
  normalizeWeightKg,
  parseDisplayWeightToKg,
  LBS_PLATES,
  KG_PLATES,
} from '../../../shared/lib/weight';
import type { LoggedExercise } from '../types';

type WeightMode = 'straight' | 'plates';

export function useWorkout(
  logSheetRef: RefObject<BottomSheetModal | null>,
  substituteSheetRef: RefObject<BottomSheetModal | null>,
) {
  const {
    session,
    currentExerciseIndex,
    logSet,
    deleteSet,
    goToExercise,
    substituteExercise,
    finishWorkout,
  } = useWorkoutStore();
  const { weightUnit, defaultRestSeconds, loadPrefs, isLoaded: prefsLoaded, setWeightUnit } =
    usePrefsStore();
  const { impact, light } = useHaptics();
  const {
    start: startRestTimer,
    reset: resetRestTimer,
    pause: pauseRestTimer,
    resume: resumeRestTimer,
    adjustSeconds: adjustRestSeconds,
    dismissComplete: dismissRestComplete,
    status: restTimerStatus,
    remainingMs: restTimerRemainingMs,
    isVisible: restTimerVisible,
  } = useRestTimer(light);

  const [logSheetVisible, setLogSheetVisible] = useState(false);
  const [overviewSheetVisible, setOverviewSheetVisible] = useState(false);
  const [substituteSheetVisible, setSubstituteSheetVisible] = useState(false);
  const [repInput, setRepInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [weightMode, setWeightMode] = useState<WeightMode>('straight');
  const [plates, setPlates] = useState<Record<number, number>>({});
  const [toFailure, setToFailure] = useState(false);
  const [rpeInput, setRpeInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  const [previousPerformances, setPreviousPerformances] = useState<
    Record<string, LoggedExercise | null>
  >({});
  const fetchedIds = useRef(new Set<string>());
  const presentRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (presentRafRef.current !== null) {
        cancelAnimationFrame(presentRafRef.current);
      }
    };
  }, []);

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
    ? normalizeWeightKg(computePlateWeightKg(plates, weightUnit), weightUnit)
    : parseDisplayWeightToKg(weightInput, weightUnit);

  const resetLogForm = useCallback(() => {
    setRepInput('');
    setWeightInput('');
    setPlates({});
    setToFailure(false);
    setRpeInput('');
    setNotesInput('');
  }, []);

  const openLogSheet = useCallback(() => {
    resetLogForm();
    if (presentRafRef.current !== null) {
      cancelAnimationFrame(presentRafRef.current);
    }
    presentRafRef.current = requestAnimationFrame(() => {
      presentRafRef.current = null;
      logSheetRef.current?.present();
    });
  }, [logSheetRef, resetLogForm]);

  const dismissLogSheet = useCallback(() => {
    logSheetRef.current?.dismiss();
  }, [logSheetRef]);

  const handleLogSheetDismiss = useCallback(() => {
    resetLogForm();
  }, [resetLogForm]);

  const handleLogSheetChange = useCallback((index: number) => {
    setLogSheetVisible(index >= 0);
  }, []);

  const handleOverviewSheetChange = useCallback((index: number) => {
    setOverviewSheetVisible(index >= 0);
  }, []);

  const handleSubstituteSheetChange = useCallback((index: number) => {
    setSubstituteSheetVisible(index >= 0);
  }, []);

  const dismissSubstituteSheet = useCallback(() => {
    substituteSheetRef.current?.dismiss();
  }, [substituteSheetRef]);

  const applySubstitute = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      await substituteExercise(currentExerciseIndex, trimmed);
      impact();
      dismissSubstituteSheet();
    },
    [currentExerciseIndex, dismissSubstituteSheet, impact, substituteExercise],
  );

  const handleConfirmSubstitute = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || !currentExercise) return;

      if (currentExercise.sets.length > 0) {
        Alert.alert(
          'Replace exercise?',
          'Substituting will clear the sets logged for this exercise.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Substitute',
              style: 'destructive',
              onPress: () => {
                void applySubstitute(trimmed);
              },
            },
          ],
        );
        return;
      }

      void applySubstitute(trimmed);
    },
    [applySubstitute, currentExercise],
  );

  const openSubstituteSheet = useCallback(() => {
    if (presentRafRef.current !== null) {
      cancelAnimationFrame(presentRafRef.current);
    }
    presentRafRef.current = requestAnimationFrame(() => {
      presentRafRef.current = null;
      substituteSheetRef.current?.present();
    });
  }, [substituteSheetRef]);

  const handleSubstitutePress = useCallback(() => {
    openSubstituteSheet();
  }, [openSubstituteSheet]);

  const handleGoToExercise = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalExercises) return;
      goToExercise(index);
    },
    [goToExercise, totalExercises],
  );

  const handleConfirmSet = useCallback(async () => {
    const reps = parseInt(repInput, 10);
    const hasValidWeight =
      weightMode === 'plates'
        ? Object.values(plates).some((count) => count > 0)
        : computedWeightKg > 0;
    if (!currentExercise || isNaN(reps) || reps <= 0 || !hasValidWeight) return;

    const rpeNum = rpeInput ? Math.min(10, Math.max(1, parseInt(rpeInput, 10))) : undefined;
    const effort =
      toFailure || rpeNum !== undefined
        ? { toFailure, ...(rpeNum !== undefined ? { rpe: rpeNum } : {}) }
        : undefined;
    const trimmedNotes = notesInput.trim();
    const notes = trimmedNotes.length > 0 ? trimmedNotes : undefined;

    const plateMeta =
      weightMode === 'plates'
        ? {
            unit: weightUnit,
            perSide: Object.fromEntries(
              Object.entries(plates).filter(([, count]) => count > 0),
            ),
          }
        : undefined;

    setIsLogging(true);
    await logSet(currentExercise.exerciseId, reps, computedWeightKg, effort, notes, plateMeta);
    impact();
    setIsLogging(false);
    dismissLogSheet();

    startRestTimer(defaultRestSeconds);
  }, [
    repInput,
    computedWeightKg,
    currentExercise,
    toFailure,
    rpeInput,
    notesInput,
    weightMode,
    plates,
    weightUnit,
    logSet,
    impact,
    dismissLogSheet,
    defaultRestSeconds,
    startRestTimer,
  ]);

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
    }
  }, [currentExerciseIndex, totalExercises, goToExercise]);

  const handleSwipePrev = useCallback(() => {
    if (currentExerciseIndex > 0) {
      goToExercise(currentExerciseIndex - 1);
    }
  }, [currentExerciseIndex, goToExercise]);

  const handleFinish = useCallback(async (completedAt?: number) => {
    resetRestTimer();
    await finishWorkout(completedAt);
  }, [finishWorkout, resetRestTimer]);

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

  const substitutionLabel = currentExercise?.substitutedForExerciseName
    ? `Substitute for ${currentExercise.substitutedForExerciseName}`
    : undefined;

  return {
    session,
    currentExercise,
    currentExerciseIndex,
    totalExercises,
    isLastExercise,
    logSheetVisible,
    overviewSheetVisible,
    substituteSheetVisible,
    substitutionLabel,
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
    notesInput,
    setNotesInput,
    isLogging,
    openLogSheet,
    handleLogSheetDismiss,
    handleLogSheetChange,
    handleOverviewSheetChange,
    handleSubstituteSheetChange,
    handleSubstitutePress,
    handleConfirmSubstitute,
    handleGoToExercise,
    handleConfirmSet,
    handleDeleteSet,
    handleSwipeNext,
    handleSwipePrev,
    handleFinish,
    currentPreviousPerformance,
    restTimerStatus,
    restTimerRemainingMs,
    restTimerVisible,
    pauseRestTimer,
    resumeRestTimer,
    adjustRestSeconds,
    dismissRestComplete,
    resetRestTimer,
  };
}
