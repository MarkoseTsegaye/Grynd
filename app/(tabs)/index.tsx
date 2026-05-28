import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSplitsList, SplitCard } from '../../src/features/splits';
import { useSplitsStore } from '../../src/features/splits';
import { useCycleStore } from '../../src/features/splits/store/cycleStore';
import { useWorkoutStore } from '../../src/features/workout';
import { Icon } from '../../src/shared/components/Icon';
import { getUpcomingDaysThroughNextRest } from '../../src/features/splits/lib/cyclePreview';

export default function HomeScreen() {
  const router = useRouter();
  const { splits, isLoaded } = useSplitsList();
  const { getExercisesForSplit } = useSplitsStore();
  const { cycle, isLoaded: cycleLoaded, loadCycle, advanceCycle } = useCycleStore();
  const { loadActiveSession, abandonWorkout, session: activeSession } = useWorkoutStore();

  useEffect(() => {
    if (!cycleLoaded) loadCycle();
  }, [cycleLoaded, loadCycle]);

  // Crash recovery: prompt if there's a stale ACTIVE_SESSION on cold start
  useEffect(() => {
    loadActiveSession().then(() => {
      const s = useWorkoutStore.getState().session;
      if (s) {
        Alert.alert(
          'Resume Workout?',
          `You have an unfinished ${s.splitName} workout.`,
          [
            { text: 'Discard', style: 'destructive', onPress: () => abandonWorkout() },
            {
              text: 'Resume',
              style: 'default',
              onPress: () => router.push(`/workout/${s.splitId}`),
            },
          ],
        );
      }
    });
  }, []);

  if (!isLoaded) {
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

  return (
    <View className="flex-1 bg-surface-0">
      <View className="px-5 pt-14 pb-4">
        <Text className="text-text-primary font-sans-bold text-4xl">Workouts</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Today card */}
        <View className="mx-5 mb-4 bg-surface-1 rounded-xl px-4 py-4">
          <Text className="text-text-secondary font-sans text-xs mb-1 tracking-widest">TODAY</Text>
          {!cycleLoaded ? (
            <Text className="text-text-disabled font-sans text-base">Loading...</Text>
          ) : todayDay === null ? (
            <View>
              <Text className="text-text-secondary font-sans text-base">No cycle configured.</Text>
              <TouchableOpacity
                className="mt-3 bg-surface-2 rounded-lg py-3 flex-row items-center justify-center gap-2"
                onPress={() => router.push('/cycle')}
                accessibilityLabel="Set up training cycle"
                activeOpacity={0.7}
              >
                <Icon name="sync-circle" size={20} color="text-secondary" />
                <Text className="text-text-secondary font-sans-bold text-base">Set Up Cycle</Text>
              </TouchableOpacity>
            </View>
          ) : todayDay.type === 'split' ? (
            <>
              <View className="flex-row items-center gap-2 mb-1">
                <Icon name="dumbbell" size={20} color="text-secondary" />
                <Text className="text-text-primary font-sans text-2xl">{todaySplit?.name ?? 'Unknown'}</Text>
              </View>
              {dayNumber !== null && (
                <Text className="text-text-secondary font-sans text-sm mb-3">
                  Day {dayNumber} of {cycleLength}
                </Text>
              )}
              <TouchableOpacity
                className="bg-accent rounded-lg py-3 flex-row items-center justify-center gap-2"
                onPress={() => todaySplit && router.push(`/workout/${todaySplit.id}`)}
                accessibilityLabel="Start today's workout"
                activeOpacity={0.7}
              >
                <Icon name="play-circle-outline" size={20} color="surface-0" />
                <Text className="text-surface-0 font-sans-bold text-base">Start Workout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-2 mb-1">
                <Icon name="sleep" size={20} color="text-secondary" />
                <Text className="text-text-primary font-sans text-2xl">Rest Day</Text>
              </View>
              {dayNumber !== null && (
                <Text className="text-text-secondary font-sans text-sm mb-3">
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
                <Text className="text-text-secondary font-sans-bold text-base">Mark Rest Done</Text>
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
                <Text className="font-sans-bold text-xs text-text-secondary">{label}</Text>
                <Text className="font-sans text-xs mt-0.5 text-text-secondary" numberOfLines={1}>
                  {day.type === 'split' ? (split?.name ?? 'Split').slice(0, 8) : 'Rest'}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* All Splits section */}
        {splits.length > 0 && (
          <View className="px-5 mb-8">
            <Text className="text-text-secondary font-sans text-xs uppercase tracking-widest mb-3">
              All Splits
            </Text>
            {splits.map((split) => (
              <SplitCard
                key={split.id}
                split={split}
                exerciseCount={getExercisesForSplit(split.id).length}
                onPress={() => router.push(`/workout/${split.id}`)}
              />
            ))}
          </View>
        )}

        {splits.length === 0 && (
          <View className="flex-1 items-center justify-center px-8 py-16">
            <Icon name="dumbbell" size={48} color="text-disabled" />
            <Text className="text-text-secondary font-sans text-base text-center mt-4">
              No splits yet.{'\n'}Go to Splits to create one.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
