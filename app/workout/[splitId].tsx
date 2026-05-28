import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useWorkout, ExerciseScreen, LogSheet } from '../../src/features/workout';
import { useWorkoutStore } from '../../src/features/workout';
import { useSplitsStore } from '../../src/features/splits';
import { Icon } from '../../src/shared/components/Icon';
import { STORAGE_KEYS } from '../../src/storage/keys';

const SWIPE_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 500;

type BootstrapState = 'loading' | 'ready' | 'error' | 'empty';

export default function WorkoutScreen() {
  const { splitId } = useLocalSearchParams<{ splitId: string }>();
  const router = useRouter();
  const { startWorkout, abandonWorkout, loadActiveSession } = useWorkoutStore();
  const { loadData } = useSplitsStore();
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>('loading');
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);

  const {
    session, currentExercise, currentExerciseIndex, totalExercises, isLastExercise,
    logSheetVisible,
    repInput, setRepInput,
    weightInput, setWeightInput,
    weightMode, toggleWeightMode,
    weightUnit, toggleUnit,
    plates, plateList, addPlate, removePlate, computedWeightKg,
    toFailure, setToFailure,
    rpeInput, setRpeInput,
    isLogging,
    openLogSheet, closeLogSheet, handleConfirmSet, handleDeleteSet,
    handleSwipeNext, handleSwipePrev, handleFinish,
    currentPreviousPerformance,
  } = useWorkout();

  // Cancel sheet
  const cancelSheetRef = useRef<BottomSheetModal>(null);
  const cancelSnapPoints = useMemo(() => ['28%'], []);
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  // Swipe hint
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const hintOpacity = useSharedValue(0);
  const hintTranslateX = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;

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
                  await startWorkoutForSplit();
                })();
              },
            },
            {
              text: 'Resume',
              style: 'default',
              onPress: () => {
                if (!cancelled) setBootstrapState('ready');
              },
            },
          ],
        );
        return;
      }

      if (storeSession && storeSession.splitId === splitId) {
        if (!cancelled) setBootstrapState('ready');
        return;
      }

      await startWorkoutForSplit();
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [splitId, loadData, loadActiveSession, startWorkout, abandonWorkout]);

  // Show swipe hint on first workout ever
  useEffect(() => {
    if (!session) return;
    AsyncStorage.getItem(STORAGE_KEYS.HAS_SEEN_SWIPE_HINT).then((val) => {
      if (!val) {
        setShowSwipeHint(true);
        hintOpacity.value = withTiming(1, { duration: 300 });
        hintTranslateX.value = withTiming(50, { duration: 1000 });
        const fadeTimer = setTimeout(() => {
          hintOpacity.value = withTiming(0, { duration: 400 });
          AsyncStorage.setItem(STORAGE_KEYS.HAS_SEEN_SWIPE_HINT, 'true');
          setTimeout(() => setShowSwipeHint(false), 400);
        }, 2000);
        return () => clearTimeout(fadeTimer);
      }
    });
  }, [session?.id]);

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [{ translateX: hintTranslateX.value }],
  }));

  const translateX = useSharedValue(0);

  // Right swipe = next exercise (or finish on last); left swipe = prev
  const doSwipeRight = useCallback(() => {
    if (isLastExercise) {
      handleFinish().then(() => router.replace('/(tabs)/history'));
    } else {
      handleSwipeNext();
    }
  }, [isLastExercise, handleFinish, handleSwipeNext, router]);

  const doSwipeLeft = useCallback(() => {
    handleSwipePrev();
  }, [handleSwipePrev]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX * 0.3;
    })
    .onEnd((e) => {
      const rightCommit =
        e.translationX > SWIPE_THRESHOLD || e.velocityX > SWIPE_VELOCITY_THRESHOLD;
      const leftCommit =
        e.translationX < -SWIPE_THRESHOLD || e.velocityX < -SWIPE_VELOCITY_THRESHOLD;

      if (rightCommit) {
        runOnJS(doSwipeRight)();
      } else if (leftCommit) {
        runOnJS(doSwipeLeft)();
      }
      translateX.value = withSpring(0);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleCancelPress = useCallback(() => {
    cancelSheetRef.current?.present();
  }, []);

  const handleDiscard = useCallback(async () => {
    cancelSheetRef.current?.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await abandonWorkout();
    router.replace('/(tabs)');
  }, [abandonWorkout, router]);

  const handleKeepGoing = useCallback(() => {
    cancelSheetRef.current?.dismiss();
  }, []);

  if (bootstrapState === 'error' || bootstrapState === 'empty') {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center px-8">
        <Text className="text-text-secondary font-sans text-base text-center">
          {bootstrapMessage}
        </Text>
        <TouchableOpacity
          className="mt-6 bg-surface-2 rounded-lg px-6 py-3"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          activeOpacity={0.7}
        >
          <Text className="text-text-primary font-sans-bold text-base">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (bootstrapState !== 'ready' || !session || !currentExercise) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center">
        <Text className="text-text-secondary font-sans text-base">Loading workout...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-0">
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ flex: 1 }, animStyle]}>
          <ExerciseScreen
            exercise={currentExercise}
            exerciseIndex={currentExerciseIndex}
            totalExercises={totalExercises}
            isLastExercise={isLastExercise}
            previousExercise={currentPreviousPerformance}
            onOpenLog={openLogSheet}
            onDeleteSet={handleDeleteSet}
            onFinish={async () => { await handleFinish(); router.replace('/(tabs)/history'); }}
            onCancel={handleCancelPress}
          />
        </Animated.View>
      </GestureDetector>

      {/* Swipe hint overlay */}
      {showSwipeHint && (
        <Animated.View
          style={[hintStyle, { position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' }]}
        >
          <Icon name="gesture-swipe-right" size={36} color="text-secondary" />
          <Text className="text-text-secondary font-sans text-xs mt-1">Swipe to next exercise</Text>
        </Animated.View>
      )}

      <LogSheet
        visible={logSheetVisible}
        repInput={repInput}
        onChangeReps={setRepInput}
        weightMode={weightMode}
        onToggleWeightMode={toggleWeightMode}
        weightUnit={weightUnit}
        onToggleUnit={toggleUnit}
        weightInput={weightInput}
        onChangeWeight={setWeightInput}
        plates={plates}
        plateList={plateList}
        onAddPlate={addPlate}
        onRemovePlate={removePlate}
        computedWeightKg={computedWeightKg}
        toFailure={toFailure}
        onToggleFailure={() => setToFailure((v) => !v)}
        rpeInput={rpeInput}
        onChangeRpe={setRpeInput}
        isLogging={isLogging}
        onConfirm={handleConfirmSet}
        onClose={closeLogSheet}
      />

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
            <Text className="text-danger font-sans-bold text-base">Discard Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center gap-3 py-4"
            onPress={handleKeepGoing}
            accessibilityLabel="Keep going"
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={22} color="text-primary" />
            <Text className="text-text-primary font-sans-bold text-base">Keep Going</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
