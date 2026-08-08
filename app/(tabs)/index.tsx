import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSplitsList, SplitCard } from '../../src/features/splits';
import { useSplitsStore } from '../../src/features/splits';
import { useCycleStore } from '../../src/features/splits/store/cycleStore';
import {
  useWorkoutStore,
  PausedWorkoutResumeCard,
  hasPausedSession,
  isIncompleteActiveSession,
} from '../../src/features/workout';
import { Icon } from '../../src/shared/components/Icon';
import { getUpcomingDaysThroughNextRest } from '../../src/features/splits/lib/cyclePreview';
import { textRoles } from '../../src/shared/theme/typography';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { splits, isLoaded } = useSplitsList();
  const { getExercisesForSplit } = useSplitsStore();
  const { cycle, isLoaded: cycleLoaded, loadCycle, advanceCycle } = useCycleStore();
  const {
    loadActiveSession,
    session: activeSession,
    isLoaded: sessionLoaded,
    abandonWorkout,
  } = useWorkoutStore();

  useEffect(() => {
    if (!cycleLoaded) loadCycle();
  }, [cycleLoaded, loadCycle]);

  useEffect(() => {
    if (!sessionLoaded) loadActiveSession();
  }, [sessionLoaded, loadActiveSession]);

  if (!isLoaded || !sessionLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  const days = cycle?.days ?? [];
  const currentIndex = cycle ? cycle.currentIndex % Math.max(1, days.length) : 0;
  const todayDay = days.length > 0 ? days[currentIndex] : null;
  const todaySplit = todayDay?.type === 'split'
    ? splits.find((s) => s.id === todayDay.splitId)
    : null;

  const nextDays = getUpcomingDaysThroughNextRest(days, currentIndex, splits);

  const cycleLength = days.length;
  const dayNumber = cycleLength > 0 ? currentIndex + 1 : null;

  const showPausedResume = hasPausedSession(activeSession);
  const pausedMatchesToday =
    showPausedResume &&
    activeSession != null &&
    todayDay?.type === 'split' &&
    todaySplit != null &&
    activeSession.splitId === todaySplit.id;
  const showPausedCard = showPausedResume && !pausedMatchesToday;

  const handleResumePausedWorkout = () => {
    if (!activeSession) return;
    router.push(`/workout/${activeSession.splitId}`);
  };

  const startWorkoutForSplit = (targetSplitId: string) => {
    if (
      isIncompleteActiveSession(activeSession) &&
      activeSession.splitId !== targetSplitId
    ) {
      Alert.alert(
        'Unfinished Workout',
        `You have an unfinished ${activeSession.splitName} workout.`,
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              void abandonWorkout().then(() => {
                router.push(`/workout/${targetSplitId}`);
              });
            },
          },
          {
            text: 'Resume',
            style: 'default',
            onPress: () => {
              router.push(`/workout/${activeSession.splitId}`);
            },
          },
        ],
      );
      return;
    }
    router.push(`/workout/${targetSplitId}`);
  };

  return (
    <View className="flex-1 bg-surface-0">
      <View
        className="px-5 pb-4"
        style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
      >
        <Text className={`text-text-primary ${textRoles.screenTitle}`}>Workouts</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {showPausedCard && activeSession && (
          <PausedWorkoutResumeCard
            splitName={activeSession.splitName}
            onResume={handleResumePausedWorkout}
          />
        )}

        {/* Today card */}
        <View className="mx-5 mb-4 bg-surface-1 rounded-xl px-4 py-4">
          <Text className={`text-text-secondary ${textRoles.sectionLabelCompact} mb-1`}>TODAY</Text>
          {!cycleLoaded ? (
            <Text className={`text-text-disabled ${textRoles.body}`}>Loading...</Text>
          ) : todayDay === null ? (
            <View>
              <Text className={`text-text-secondary ${textRoles.body}`}>No cycle configured.</Text>
              <TouchableOpacity
                className="mt-3 bg-surface-2 rounded-lg py-3 flex-row items-center justify-center gap-2"
                onPress={() => router.push('/cycle')}
                accessibilityLabel="Set up training cycle"
                activeOpacity={0.7}
              >
                <Icon name="sync-circle" size={20} color="text-secondary" />
                <Text className={`text-text-secondary ${textRoles.buttonLabel}`}>Set Up Cycle</Text>
              </TouchableOpacity>
            </View>
          ) : todayDay.type === 'split' ? (
            <>
              <View className="flex-row items-center gap-2 mb-1">
                <Icon name="dumbbell" size={20} color="text-secondary" />
                <Text className={`text-text-primary ${textRoles.listTitle}`} numberOfLines={1}>
                  {todaySplit?.name ?? 'Unknown'}
                </Text>
              </View>
              {dayNumber !== null && (
                <Text className={`text-text-secondary ${textRoles.bodySmall} mb-3`}>
                  Day {dayNumber} of {cycleLength}
                </Text>
              )}
              {pausedMatchesToday && activeSession ? (
                <TouchableOpacity
                  className="bg-accent rounded-lg py-3 flex-row items-center justify-center gap-2"
                  onPress={handleResumePausedWorkout}
                  accessibilityLabel="Resume paused workout"
                  activeOpacity={0.7}
                >
                  <Icon name="play-circle-outline" size={20} color="surface-0" />
                  <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>
                    Resume {activeSession.splitName}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="bg-accent rounded-lg py-3 flex-row items-center justify-center gap-2"
                  onPress={() => todaySplit && startWorkoutForSplit(todaySplit.id)}
                  accessibilityLabel="Start today's workout"
                  activeOpacity={0.7}
                >
                  <Icon name="play-circle-outline" size={20} color="surface-0" />
                  <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>Start Workout</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-2 mb-1">
                <Icon name="sleep" size={20} color="text-secondary" />
                <Text className={`text-text-primary ${textRoles.listTitle}`}>Rest Day</Text>
              </View>
              {dayNumber !== null && (
                <Text className={`text-text-secondary ${textRoles.bodySmall} mb-3`}>
                  Day {dayNumber} of {cycleLength}
                </Text>
              )}
              <TouchableOpacity
                className="bg-surface-2 rounded-lg py-3 flex-row items-center justify-center gap-2"
                onPress={advanceCycle}
                accessibilityLabel="Mark rest day done"
                activeOpacity={0.7}
              >
                <Icon name="arrow-right-circle-outline" size={20} color="text-secondary" />
                <Text className={`text-text-secondary ${textRoles.buttonLabel}`}>Mark Rest Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Next days pill row */}
        {nextDays.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-5 mb-6"
            contentContainerStyle={{ gap: 8 }}
          >
            {nextDays.map(({ day, split, label, idx }) => (
              <View
                key={`${idx}-${day.id}`}
                className="rounded-lg px-3 py-2 items-center min-w-16 bg-surface-2"
              >
                <Text className={`${textRoles.captionBold} text-text-secondary`}>{label}</Text>
                <Text className={`${textRoles.caption} mt-0.5 text-text-secondary`} numberOfLines={1}>
                  {day.type === 'split' ? (split?.name ?? 'Split').slice(0, 8) : 'Rest'}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* All Splits section */}
        {splits.length > 0 && (
          <View className="px-5 mb-8">
            <Text className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}>
              All Splits
            </Text>
            {splits.map((split) => (
              <SplitCard
                key={split.id}
                split={split}
                exerciseCount={getExercisesForSplit(split.id).length}
                onPress={() => startWorkoutForSplit(split.id)}
              />
            ))}
          </View>
        )}

        {splits.length === 0 && (
          <View className="flex-1 items-center justify-center px-8 py-16">
            <Icon name="dumbbell" size={48} color="text-disabled" />
            <Text className={`text-text-secondary ${textRoles.body} text-center mt-4`}>
              No splits yet.{'\n'}Go to Splits to create one.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
