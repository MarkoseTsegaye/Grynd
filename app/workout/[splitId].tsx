import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions, AppState, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useWorkout, ExerciseScreen, ExerciseOverviewSheet, SubstituteExerciseSheet } from '../../src/features/workout';
import { FinishWorkoutSheet } from '../../src/features/workout/components/FinishWorkoutSheet';
import { useWorkoutStore } from '../../src/features/workout';
import { useSplitsStore } from '../../src/features/splits';
import { useHistoryStore } from '../../src/features/history';
import { Icon } from '../../src/shared/components/Icon';
import { textRoles } from '../../src/shared/theme/typography';
import { STORAGE_KEYS } from '../../src/storage/keys';
import {
  SWIPE_THRESHOLD,
  SWIPE_VELOCITY_THRESHOLD,
  COMMIT_EXIT_TIMING,
  COMMIT_ENTER_TIMING,
  CANCEL_SPRING,
  clampDragTranslation,
} from '../../src/features/workout/constants/swipeMotion';

const SCREEN_WIDTH = Dimensions.get('window').width;

type BootstrapState = 'loading' | 'ready' | 'error' | 'empty';

export default function WorkoutScreen() {
  const { splitId } = useLocalSearchParams<{ splitId: string }>();
  const router = useRouter();
  const { startWorkout, abandonWorkout, leaveWorkout, loadActiveSession, resumeWorkoutEntry } =
    useWorkoutStore();
  const { loadData } = useSplitsStore();
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>('loading');
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [allowLeave, setAllowLeave] = useState(false);

  const overviewSheetRef = useRef<BottomSheetModal>(null);
  const substituteSheetRef = useRef<BottomSheetModal>(null);
  const finishSheetRef = useRef<BottomSheetModal>(null);

  const {
    session, currentExercise, currentExerciseIndex, totalExercises, isLastExercise,
    overviewSheetVisible, substituteSheetVisible, substitutionLabel,
    repInput, setRepInput,
    weightInput, setWeightInput,
    weightMode, toggleWeightMode,
    weightUnit, toggleUnit,
    plates, plateList, addPlate, removePlate, clearPlates, computedWeightKg,
    setSide, setSetSide, isUnilateral,
    toFailure, setToFailure,
    rir, setRir,
    notesInput, setNotesInput,
    isLogging,
    isEditingSet, editingSetIndex,
    padCollapsed, togglePadCollapsed,
    openEditSet, cancelEditSet, handleConfirmSet, handleDeleteSet,
    handleOverviewSheetChange, handleSubstituteSheetChange, handleSubstitutePress, handleConfirmSubstitute,
    handleGoToExercise,
    handleSwipeNext, handleSwipePrev, handleFinish,
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
  } = useWorkout(substituteSheetRef);

  // One tap on the slim rest bar pauses or resumes, whichever applies.
  const handleRestToggle = useCallback(() => {
    if (restTimerStatus === 'running') {
      pauseRestTimer();
    } else if (restTimerStatus === 'paused') {
      resumeRestTimer();
    }
  }, [restTimerStatus, pauseRestTimer, resumeRestTimer]);

  const handleRestDismiss = useCallback(() => {
    if (restTimerStatus === 'complete') {
      dismissRestComplete();
    } else {
      resetRestTimer();
    }
  }, [restTimerStatus, dismissRestComplete, resetRestTimer]);

  const openOverview = useCallback(() => {
    overviewSheetRef.current?.present();
  }, []);

  const handleSelectExercise = useCallback(
    (index: number) => {
      handleGoToExercise(index);
    },
    [handleGoToExercise],
  );

  // Cancel sheet
  const cancelSheetRef = useRef<BottomSheetModal>(null);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const cancelSnapPoints = useMemo(() => ['38%'], []);
  const [finishSheetVisible, setFinishSheetVisible] = useState(false);
  const sheetBlocksSwipe =
    overviewSheetVisible || substituteSheetVisible || finishSheetVisible;
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const shouldPreventLeave =
    !allowLeave && bootstrapState === 'ready' && !!session && session.pausedAt == null;

  usePreventRemove(shouldPreventLeave, () => {
    cancelSheetRef.current?.present();
  });

  const beginIntentionalLeave = useCallback((navigate: () => void) => {
    pendingLeaveRef.current = navigate;
    setAllowLeave(true);
  }, []);

  useEffect(() => {
    if (!allowLeave) return;
    const pending = pendingLeaveRef.current;
    if (!pending) return;
    pendingLeaveRef.current = null;
    pending();
  }, [allowLeave]);

  // Swipe hint
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const hintOpacity = useSharedValue(0);
  const hintTranslateX = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    setAllowLeave(false);

    const startWorkoutForSplit = async () => {
      const { getSplitById, getExercisesForSplit } = useSplitsStore.getState();
      const split = getSplitById(splitId);
      const exercises = getExercisesForSplit(splitId);

      if (!split) {
        if (!cancelled) {
          setBootstrapMessage('Split not found.');
          setBootstrapState('error');
        }
        return;
      }

      if (exercises.length === 0) {
        if (!cancelled) {
          setBootstrapMessage('Add exercises to this split before starting a workout.');
          setBootstrapState('empty');
        }
        return;
      }

      try {
        await startWorkout(split, exercises);
        if (!cancelled) setBootstrapState('ready');
      } catch (err) {
        if (!cancelled) {
          setBootstrapMessage(String(err));
          setBootstrapState('error');
        }
      }
    };

    async function init() {
      setBootstrapState('loading');
      setBootstrapMessage(null);

      const { isLoaded } = useSplitsStore.getState();
      if (!isLoaded) {
        await loadData();
        if (cancelled) return;
      }

      await loadActiveSession();
      if (cancelled) return;

      const storeSession = useWorkoutStore.getState().session;

      if (storeSession && storeSession.splitId !== splitId) {
        // Leave loading so a dismissed Android alert cannot stick the screen forever.
        setBootstrapMessage(
          `You have an unfinished ${storeSession.splitName} workout.`,
        );
        setBootstrapState('error');
        Alert.alert(
          'Unfinished Workout',
          `You have an unfinished ${storeSession.splitName} workout.`,
          [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  await abandonWorkout();
                  if (cancelled) return;
                  setBootstrapState('loading');
                  setBootstrapMessage(null);
                  await startWorkoutForSplit();
                })();
              },
            },
            {
              text: 'Resume',
              style: 'default',
              onPress: () => {
                if (cancelled) return;
                router.replace(`/workout/${storeSession.splitId}`);
              },
            },
          ],
          { cancelable: false },
        );
        return;
      }

      if (storeSession && storeSession.splitId === splitId) {
        await resumeWorkoutEntry(splitId);
        if (!cancelled) setBootstrapState('ready');
        return;
      }

      await startWorkoutForSplit();
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [splitId, loadData, loadActiveSession, startWorkout, abandonWorkout, resumeWorkoutEntry, router]);

  useEffect(() => {
    if (!shouldPreventLeave) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      cancelSheetRef.current?.present();
      return true;
    });

    return () => subscription.remove();
  }, [shouldPreventLeave]);

  // Show swipe hint on first workout ever
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    void AsyncStorage.getItem(STORAGE_KEYS.HAS_SEEN_SWIPE_HINT).then((val) => {
      if (cancelled || val) return;
      setShowSwipeHint(true);
      hintOpacity.value = withTiming(1, { duration: 300 });
      hintTranslateX.value = withTiming(-50, { duration: 1000 });
      fadeTimer = setTimeout(() => {
        hintOpacity.value = withTiming(0, { duration: 400 });
        void AsyncStorage.setItem(STORAGE_KEYS.HAS_SEEN_SWIPE_HINT, 'true');
        hideTimer = setTimeout(() => {
          if (!cancelled) setShowSwipeHint(false);
        }, 400);
      }, 2000);
    });

    return () => {
      cancelled = true;
      if (fadeTimer) clearTimeout(fadeTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [session?.id]);

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [{ translateX: hintTranslateX.value }],
  }));

  const translateX = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const canGoPrev = useSharedValue(currentExerciseIndex > 0);
  const isLastExerciseSV = useSharedValue(isLastExercise);

  useEffect(() => {
    canGoPrev.value = currentExerciseIndex > 0;
    isLastExerciseSV.value = isLastExercise;
  }, [canGoPrev, currentExerciseIndex, isLastExercise, isLastExerciseSV]);

  useEffect(() => {
    if (!sheetBlocksSwipe) {
      translateX.value = 0;
      isAnimating.value = false;
    }
  }, [isAnimating, sheetBlocksSwipe, translateX]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        translateX.value = 0;
        isAnimating.value = false;
      }
    });
    return () => subscription.remove();
  }, [isAnimating, translateX]);

  const triggerSwipeCommitHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const afterSwipeNext = useCallback(() => {
    handleSwipeNext();
  }, [handleSwipeNext]);

  const afterSwipePrev = useCallback(() => {
    handleSwipePrev();
  }, [handleSwipePrev]);

  const presentFinishSheet = useCallback(() => {
    finishSheetRef.current?.present();
  }, []);

  const afterSwipeFinish = useCallback(() => {
    isAnimating.value = false;
    translateX.value = 0;
    presentFinishSheet();
  }, [isAnimating, presentFinishSheet, translateX]);

  const handleFinishSheetChange = useCallback((index: number) => {
    setFinishSheetVisible(index >= 0);
  }, []);

  const handleCancelFinish = useCallback(() => {
    // Sheet dismiss only — active session remains.
  }, []);

  const handleConfirmFinish = useCallback(
    async (completedAt: number) => {
      const sessionId = session?.id;
      if (!sessionId) throw new Error('No active session');

      await handleFinish(completedAt);
      await useHistoryStore.getState().loadSessions();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      finishSheetRef.current?.dismiss();
      beginIntentionalLeave(() => {
        router.replace(`/history/${sessionId}`);
      });
    },
    [beginIntentionalLeave, handleFinish, router, session?.id],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!sheetBlocksSwipe)
        .activeOffsetX([-20, 20])
        .onUpdate((e) => {
          if (isAnimating.value) return;
          translateX.value = clampDragTranslation(
            e.translationX,
            canGoPrev.value,
            SCREEN_WIDTH,
          );
        })
        .onEnd((e) => {
          if (isAnimating.value) return;

          const rightCommit =
            e.translationX > SWIPE_THRESHOLD || e.velocityX > SWIPE_VELOCITY_THRESHOLD;
          const leftCommit =
            e.translationX < -SWIPE_THRESHOLD || e.velocityX < -SWIPE_VELOCITY_THRESHOLD;

          if (leftCommit) {
            isAnimating.value = true;
            if (!isLastExerciseSV.value) {
              runOnJS(triggerSwipeCommitHaptic)();
            }
            translateX.value = withTiming(-SCREEN_WIDTH, COMMIT_EXIT_TIMING, (finished) => {
              if (!finished) {
                isAnimating.value = false;
                return;
              }
              if (isLastExerciseSV.value) {
                runOnJS(afterSwipeFinish)();
                return;
              }
              runOnJS(afterSwipeNext)();
              translateX.value = SCREEN_WIDTH;
              translateX.value = withTiming(0, COMMIT_ENTER_TIMING, (enterFinished) => {
                if (enterFinished) {
                  isAnimating.value = false;
                }
              });
            });
            return;
          }

          if (rightCommit && canGoPrev.value) {
            isAnimating.value = true;
            runOnJS(triggerSwipeCommitHaptic)();
            translateX.value = withTiming(SCREEN_WIDTH, COMMIT_EXIT_TIMING, (finished) => {
              if (!finished) {
                isAnimating.value = false;
                return;
              }
              runOnJS(afterSwipePrev)();
              translateX.value = -SCREEN_WIDTH;
              translateX.value = withTiming(0, COMMIT_ENTER_TIMING, (enterFinished) => {
                if (enterFinished) {
                  isAnimating.value = false;
                }
              });
            });
            return;
          }

          translateX.value = withSpring(0, CANCEL_SPRING);
        }),
    [
      afterSwipeFinish,
      afterSwipeNext,
      afterSwipePrev,
      canGoPrev,
      isAnimating,
      isLastExerciseSV,
      overviewSheetVisible,
      substituteSheetVisible,
      finishSheetVisible,
      sheetBlocksSwipe,
      translateX,
      triggerSwipeCommitHaptic,
    ],
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const renderSwipeable = useCallback(
    (body: React.ReactNode) => (
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ flex: 1 }, animStyle]}>{body}</Animated.View>
      </GestureDetector>
    ),
    [panGesture, animStyle],
  );

  const handleCancelPress = useCallback(() => {
    cancelSheetRef.current?.present();
  }, []);

  const handleDiscard = useCallback(async () => {
    cancelSheetRef.current?.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    resetRestTimer();
    beginIntentionalLeave(() => {
      void (async () => {
        await abandonWorkout();
        router.replace('/(tabs)');
      })();
    });
  }, [abandonWorkout, beginIntentionalLeave, router, resetRestTimer]);

  const handleLeaveWorkout = useCallback(async () => {
    cancelSheetRef.current?.dismiss();
    overviewSheetRef.current?.dismiss();
    substituteSheetRef.current?.dismiss();
    finishSheetRef.current?.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetRestTimer();
    beginIntentionalLeave(() => {
      void (async () => {
        await leaveWorkout();
        router.replace('/(tabs)');
      })();
    });
  }, [beginIntentionalLeave, leaveWorkout, router, resetRestTimer]);

  const handleKeepGoing = useCallback(() => {
    cancelSheetRef.current?.dismiss();
  }, []);

  if (bootstrapState === 'error' || bootstrapState === 'empty') {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center px-8">
        <Text className={`text-text-secondary ${textRoles.body} text-center`}>
          {bootstrapMessage}
        </Text>
        <TouchableOpacity
          className="mt-6 bg-surface-2 rounded-lg px-6 py-3"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          activeOpacity={0.7}
        >
          <Text className={`text-text-primary ${textRoles.buttonLabel}`}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (bootstrapState !== 'ready' || !session || !currentExercise) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center">
        <Text className={`text-text-secondary ${textRoles.body}`}>Loading workout...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-0">
      <ExerciseScreen
        exercise={currentExercise}
        exerciseIndex={currentExerciseIndex}
        totalExercises={totalExercises}
        isLastExercise={isLastExercise}
        previousExercise={currentPreviousPerformance}
        weightMode={weightMode}
        padCollapsed={padCollapsed}
        onTogglePad={togglePadCollapsed}
        weightValue={weightInput}
        repValue={repInput}
        onChangeWeight={setWeightInput}
        onChangeReps={setRepInput}
        computedWeightKg={computedWeightKg}
        plates={plates}
        plateList={plateList}
        onAddPlate={addPlate}
        onRemovePlate={removePlate}
        onClearPlates={clearPlates}
        onToggleUnit={toggleUnit}
        toFailure={toFailure}
        onToggleFailure={() => setToFailure((v) => !v)}
        rir={rir}
        onChangeRir={setRir}
        notes={notesInput}
        onChangeNotes={setNotesInput}
        isUnilateral={isUnilateral}
        setSide={setSide}
        onChangeSide={setSetSide}
        isLogging={isLogging}
        onLog={handleConfirmSet}
        editingSetIndex={editingSetIndex}
        onEditSet={openEditSet}
        onCancelEdit={cancelEditSet}
        onDeleteSet={handleDeleteSet}
        onFinish={presentFinishSheet}
        onCancel={handleCancelPress}
        onOpenOverview={openOverview}
        onSubstitute={handleSubstitutePress}
        substitutionLabel={substitutionLabel}
        overviewDisabled={substituteSheetVisible}
        renderSwipeable={renderSwipeable}
        restTimerVisible={restTimerVisible}
        restTimerStatus={restTimerStatus}
        restTimerRemainingMs={restTimerRemainingMs}
        restTimerProgress={restTimerProgress}
        onRestTimerToggle={handleRestToggle}
        onRestTimerAdjustPlus={() => adjustRestSeconds(15)}
        onRestTimerDismiss={handleRestDismiss}
      />

      {/* Swipe hint overlay */}
      {showSwipeHint && (
        <Animated.View
          style={[hintStyle, { position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' }]}
        >
          <Icon name="gesture-swipe-left" size={36} color="text-secondary" />
          <Text className={`text-text-secondary ${textRoles.caption} mt-1`}>Swipe left for next exercise</Text>
        </Animated.View>
      )}


      {session && (
        <ExerciseOverviewSheet
          sheetRef={overviewSheetRef}
          exercises={session.exercises}
          currentExerciseIndex={currentExerciseIndex}
          onSelectExercise={handleSelectExercise}
          onChange={handleOverviewSheetChange}
        />
      )}

      <SubstituteExerciseSheet
        sheetRef={substituteSheetRef}
        onChange={handleSubstituteSheetChange}
        onConfirm={handleConfirmSubstitute}
        onClose={() => {}}
      />

      {session && (
        <FinishWorkoutSheet
          session={session}
          sheetRef={finishSheetRef}
          onConfirm={handleConfirmFinish}
          onCancel={handleCancelFinish}
          onChange={handleFinishSheetChange}
        />
      )}

      {/* Cancel workout confirmation sheet */}
      <BottomSheetModal
        ref={cancelSheetRef}
        snapPoints={cancelSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#141414' }}
        handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
      >
        <BottomSheetView className="px-6 pb-8 pt-2">
          <TouchableOpacity
            className="flex-row items-center gap-3 py-4 border-b border-surface-2"
            onPress={handleDiscard}
            accessibilityLabel="Discard workout"
            activeOpacity={0.7}
          >
            <Icon name="trash-can-outline" size={22} color="danger" />
            <Text className={`text-danger ${textRoles.buttonLabel}`}>Discard Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center gap-3 py-4 border-b border-surface-2"
            onPress={handleLeaveWorkout}
            accessibilityLabel="Leave workout"
            activeOpacity={0.7}
          >
            <Icon name="exit-to-app" size={22} color="text-primary" />
            <Text className={`text-text-primary ${textRoles.buttonLabel}`}>Leave Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center gap-3 py-4"
            onPress={handleKeepGoing}
            accessibilityLabel="Keep going"
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={22} color="text-primary" />
            <Text className={`text-text-primary ${textRoles.buttonLabel}`}>Keep Going</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
