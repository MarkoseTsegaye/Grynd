import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { showDialog } from '../../../shared/lib/dialog';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useWorkoutStore } from '../store/workoutStore';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { useHaptics } from '../../../shared/hooks/useHaptics';
import { useRestTimer } from './useRestTimer';
import { getPreviousPerformance } from '../../../storage/adapters/sessions';
import {
  computePlateWeightKg,
  formatWeight,
  normalizeWeightKg,
  parseDisplayWeightToKg,
  LBS_PLATES,
  KG_PLATES,
} from '../../../shared/lib/weight';
import { buildEffort, getSetRir } from '../lib/effort';
import type { LoggedExercise, LoggedSet } from '../types';

type WeightMode = 'straight' | 'plates';

function presentSheet(
  sheetRef: RefObject<BottomSheetModal | null>,
  presentRafRef: { current: number | null },
) {
  if (presentRafRef.current !== null) {
    cancelAnimationFrame(presentRafRef.current);
  }
  presentRafRef.current = requestAnimationFrame(() => {
    presentRafRef.current = null;
    sheetRef.current?.present();
  });
}

export function useWorkout(substituteSheetRef: RefObject<BottomSheetModal | null>) {
  const {
    session,
    currentExerciseIndex,
    logSet,
    updateSet,
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
    progress: restTimerProgress,
    isVisible: restTimerVisible,
  } = useRestTimer(light);

  const [overviewSheetVisible, setOverviewSheetVisible] = useState(false);
  const [substituteSheetVisible, setSubstituteSheetVisible] = useState(false);
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [repInput, setRepInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [weightMode, setWeightMode] = useState<WeightMode>('straight');
  const [plates, setPlates] = useState<Record<number, number>>({});
  const [setSide, setSetSide] = useState<'left' | 'right'>('left');
  const [toFailure, setToFailure] = useState(false);
  const [rir, setRir] = useState<number | undefined>(undefined);
  const [notesInput, setNotesInput] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [padCollapsed, setPadCollapsed] = useState(false);

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
  const isEditingSet = editingSetIndex !== null;

  // Lazy-load previous performance for the current exercise (use planned id for substitutes)
  useEffect(() => {
    if (!currentExercise || !session) return;
    const lookupId =
      currentExercise.substitutedForExerciseId ?? currentExercise.exerciseId;
    if (fetchedIds.current.has(lookupId)) return;
    fetchedIds.current.add(lookupId);
    getPreviousPerformance(lookupId, session.id).then((result) => {
      setPreviousPerformances((prev) => ({ ...prev, [lookupId]: result }));
    });
  }, [
    currentExercise?.exerciseId,
    currentExercise?.substitutedForExerciseId,
    session?.id,
  ]);

  const currentPreviousPerformance = currentExercise
    ? (previousPerformances[
        currentExercise.substitutedForExerciseId ?? currentExercise.exerciseId
      ] ?? null)
    : null;

  const plateList = weightUnit === 'lbs' ? LBS_PLATES : KG_PLATES;

  const computedWeightKg: number = weightMode === 'plates'
    ? normalizeWeightKg(computePlateWeightKg(plates, weightUnit), weightUnit)
    : parseDisplayWeightToKg(weightInput, weightUnit);

  const resetLogForm = useCallback(() => {
    setRepInput('');
    setWeightInput('');
    setPlates({});
    setSetSide('left');
    setToFailure(false);
    setRir(undefined);
    setNotesInput('');
    setWeightMode(currentExercise?.plateLoaded ? 'plates' : 'straight');
    setEditingSetIndex(null);
  }, [currentExercise?.plateLoaded]);

  /** Clears only the per-set metadata, leaving weight/reps for the next set. */
  const resetSetMetadata = useCallback(() => {
    setToFailure(false);
    setRir(undefined);
    setNotesInput('');
  }, []);

  // Reset the docked log form when switching exercises so each starts clean
  // and in its correct entry mode (plate pad vs number keypad).
  useEffect(() => {
    resetLogForm();
  }, [currentExercise?.exerciseId, resetLogForm]);

  const clearPlates = useCallback(() => setPlates({}), []);

  const togglePadCollapsed = useCallback(() => setPadCollapsed((v) => !v), []);

  // Collapse the pad while resting so the set list owns the screen, and hand it
  // back the moment rest ends. Editing a set always wins — it needs the pad.
  const wasRestingRef = useRef(false);
  useEffect(() => {
    const isResting = restTimerStatus === 'running' || restTimerStatus === 'paused';
    if (isResting && !wasRestingRef.current && editingSetIndex === null) {
      setPadCollapsed(true);
    } else if (!isResting && wasRestingRef.current) {
      setPadCollapsed(false);
    }
    wasRestingRef.current = isResting;
  }, [restTimerStatus, editingSetIndex]);

  const populateFormFromSet = useCallback(
    (set: LoggedSet) => {
      setRepInput(String(set.reps));
      setNotesInput(set.notes ?? '');
      setToFailure(set.effort?.toFailure ?? false);
      setRir(getSetRir(set.effort));

      const hasPlates =
        !!set.plates &&
        Object.values(set.plates.perSide).some((count) => count > 0) &&
        set.plates.unit === weightUnit;

      if (hasPlates && set.plates) {
        setWeightMode('plates');
        setPlates({ ...set.plates.perSide });
        setWeightInput('');
      } else {
        setWeightMode('straight');
        setPlates({});
        setWeightInput(formatWeight(set.weightKg, weightUnit));
      }
      setSetSide(set.side === 'right' ? 'right' : 'left');
    },
    [weightUnit],
  );

  /** Loads a logged set into the docked pad for editing — no modal involved. */
  const openEditSet = useCallback(
    (setIndex: number) => {
      if (!currentExercise) return;
      const set = currentExercise.sets[setIndex];
      if (!set) return;

      setEditingSetIndex(setIndex);
      populateFormFromSet(set);
      setPadCollapsed(false);
    },
    [currentExercise, populateFormFromSet],
  );

  const cancelEditSet = useCallback(() => {
    resetLogForm();
  }, [resetLogForm]);


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
        showDialog(
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
    presentSheet(substituteSheetRef, presentRafRef);
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

    const effort = buildEffort(toFailure, rir);
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

    const editingIndex = editingSetIndex;
    // Start rest after every newly logged set; skip when editing an existing set.
    const shouldStartRest = editingIndex === null;
    setIsLogging(true);
    try {
      if (editingIndex !== null) {
        await updateSet(
          currentExercise.exerciseId,
          editingIndex,
          reps,
          computedWeightKg,
          effort,
          notes,
          plateMeta,
          currentExercise.unilateral ? setSide : undefined,
        );
      } else {
        await logSet(
          currentExercise.exerciseId,
          reps,
          computedWeightKg,
          effort,
          notes,
          plateMeta,
          currentExercise.unilateral ? setSide : undefined,
        );
      }
      impact();

      // Keep the weight (or plate load) so back-to-back sets stay fast, but
      // never carry this set's reps or metadata onto the next one. Saving an
      // edit additionally drops back out of edit mode.
      setEditingSetIndex(null);
      setRepInput('');
      resetSetMetadata();

      if (shouldStartRest) {
        startRestTimer(defaultRestSeconds);
      }
    } finally {
      setIsLogging(false);
    }
  }, [
    repInput,
    computedWeightKg,
    currentExercise,
    toFailure,
    rir,
    notesInput,
    weightMode,
    plates,
    weightUnit,
    setSide,
    editingSetIndex,
    logSet,
    updateSet,
    impact,
    defaultRestSeconds,
    startRestTimer,
    resetLogForm,
    resetSetMetadata,
  ]);

  const handleDeleteSet = useCallback(
    async (setIndex: number) => {
      if (!currentExercise) return;
      light();
      // Editing the row being removed would leave the pad pointed at a gone index.
      if (editingSetIndex === setIndex) {
        resetLogForm();
      }
      await deleteSet(currentExercise.exerciseId, setIndex);
    },
    [currentExercise, deleteSet, editingSetIndex, light, resetLogForm],
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
    overviewSheetVisible,
    substituteSheetVisible,
    substitutionLabel,
    isEditingSet,
    editingSetIndex,
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
    clearPlates,
    plateList,
    computedWeightKg,
    setSide,
    setSetSide,
    isUnilateral: !!currentExercise?.unilateral,
    toFailure,
    setToFailure,
    rir,
    setRir,
    notesInput,
    setNotesInput,
    isLogging,
    padCollapsed,
    togglePadCollapsed,
    openEditSet,
    cancelEditSet,
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
    restTimerProgress,
    restTimerVisible,
    pauseRestTimer,
    resumeRestTimer,
    adjustRestSeconds,
    dismissRestComplete,
    resetRestTimer,
  };
}
