import React, { useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCycleStore } from '../../src/features/splits/store/cycleStore';
import { useSplitsStore } from '../../src/features/splits';
import { usePrefsStore } from '../../src/shared/store/prefsStore';
import { Icon } from '../../src/shared/components/Icon';
import { colors } from '../../src/shared/theme/colors';
import type { Split } from '../../src/features/splits/types';
import type { WorkoutCycle } from '../../src/features/splits/types';

function getCycleSummary(cycle: WorkoutCycle | null, splits: Split[]): string {
  const days = cycle?.days ?? [];
  if (days.length === 0) return 'Not configured';

  const currentIndex = cycle!.currentIndex % days.length;
  const day = days[currentIndex];
  const dayNumber = currentIndex + 1;

  let dayLabel: string;
  if (day.type === 'rest') {
    dayLabel = 'Rest';
  } else {
    const split = splits.find((s) => s.id === day.splitId);
    dayLabel = split?.name ?? 'Unknown split';
  }

  return `Day ${dayNumber} of ${days.length} · ${dayLabel}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { cycle, isLoaded: cycleLoaded, loadCycle, resetCyclePosition } = useCycleStore();
  const { splits, isLoaded: splitsLoaded, loadData } = useSplitsStore();
  const {
    weightUnit,
    autoAdvanceCycle,
    isLoaded: prefsLoaded,
    loadPrefs,
    setWeightUnit,
    setAutoAdvanceCycle,
  } = usePrefsStore();

  useEffect(() => {
    if (!cycleLoaded) loadCycle();
    if (!splitsLoaded) loadData();
    if (!prefsLoaded) loadPrefs();
  }, [cycleLoaded, loadCycle, splitsLoaded, loadData, prefsLoaded, loadPrefs]);

  useFocusEffect(
    useCallback(() => {
      loadCycle();
    }, [loadCycle]),
  );

  const isReady = cycleLoaded && splitsLoaded && prefsLoaded;
  const days = cycle?.days ?? [];
  const canReset = days.length > 0;
  const cycleSummary = getCycleSummary(cycle, splits);

  const handleReset = useCallback(() => {
    if (!canReset) return;

    Alert.alert(
      'Reset to Day 1?',
      'Your cycle days will stay the same. Only the current position resets to day 1.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => resetCyclePosition(),
        },
      ],
    );
  }, [canReset, resetCyclePosition]);

  if (!isReady) {
    return <View className="flex-1 bg-surface-0" />;
  }

  return (
    <View className="flex-1 bg-surface-0">
      <View className="px-5 pt-14 pb-4">
        <Text className="text-text-primary font-sans-bold text-4xl">Settings</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-8">
          <Text className="text-text-secondary font-sans text-xs uppercase tracking-widest mb-3">
            Units
          </Text>

          <View className="bg-surface-1 rounded-lg px-4 py-4 mb-8 flex-row items-center">
            <View className="flex-1 mr-3">
              <Text className="text-text-primary font-sans-bold text-base">Weight unit</Text>
              <Text className="text-text-secondary font-sans text-sm mt-0.5">
                Show and log weights in kilograms or pounds
              </Text>
            </View>
            <View className="flex-row gap-1">
              <TouchableOpacity
                className={`px-3 py-1.5 rounded ${weightUnit === 'kg' ? 'bg-accent' : 'bg-surface-2'}`}
                onPress={() => weightUnit !== 'kg' && setWeightUnit('kg')}
                accessibilityLabel="Weight unit, kilograms"
                activeOpacity={0.7}
              >
                <Text className={`font-sans text-sm ${weightUnit === 'kg' ? 'text-surface-0' : 'text-text-secondary'}`}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-1.5 rounded ${weightUnit === 'lbs' ? 'bg-accent' : 'bg-surface-2'}`}
                onPress={() => weightUnit !== 'lbs' && setWeightUnit('lbs')}
                accessibilityLabel="Weight unit, pounds"
                activeOpacity={0.7}
              >
                <Text className={`font-sans text-sm ${weightUnit === 'lbs' ? 'text-surface-0' : 'text-text-secondary'}`}>lbs</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text className="text-text-secondary font-sans text-xs uppercase tracking-widest mb-3">
            Training Cycle
          </Text>

          <TouchableOpacity
            className="bg-surface-1 rounded-lg px-4 py-4 mb-3 flex-row items-center"
            onPress={() => router.push('/cycle')}
            accessibilityLabel="Edit training cycle"
            activeOpacity={0.7}
          >
            <View className="flex-1 mr-3">
              <Text className="text-text-primary font-sans-bold text-base">Edit Training Cycle</Text>
              <Text className="text-text-secondary font-sans text-sm mt-0.5">{cycleSummary}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="text-secondary" />
          </TouchableOpacity>

          <View className="bg-surface-1 rounded-lg px-4 py-4 mb-3 flex-row items-center">
            <View className="flex-1 mr-3">
              <Text className="text-text-primary font-sans-bold text-base">Auto-advance after workout</Text>
              <Text className="text-text-secondary font-sans text-sm mt-0.5">
                Move to the next cycle day when a workout is finished
              </Text>
            </View>
            <Switch
              value={autoAdvanceCycle}
              onValueChange={setAutoAdvanceCycle}
              trackColor={{ false: colors['surface-2'], true: colors.accent }}
              thumbColor={colors['text-primary']}
              accessibilityLabel="Auto-advance after workout"
            />
          </View>

          <TouchableOpacity
            className={`bg-surface-1 rounded-lg px-4 py-4 flex-row items-center ${!canReset ? 'opacity-40' : ''}`}
            onPress={handleReset}
            disabled={!canReset}
            accessibilityLabel="Reset to day 1"
            accessibilityState={{ disabled: !canReset }}
            activeOpacity={0.7}
          >
            <View className="flex-1">
              <Text className="text-danger font-sans-bold text-base">Reset to Day 1</Text>
              <Text className="text-text-secondary font-sans text-sm mt-0.5">
                {canReset ? 'Start the cycle over from day 1' : 'Configure a cycle first'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
