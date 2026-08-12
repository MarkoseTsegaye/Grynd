import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showDialog } from '../../src/shared/lib/dialog';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCycleStore } from '../../src/features/splits/store/cycleStore';
import { useSplitsStore } from '../../src/features/splits';
import { usePrefsStore } from '../../src/shared/store/prefsStore';
import {
  REST_PRESETS,
  REST_STEP_SECONDS,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  formatRestDuration,
  isRestPreset,
  stepRestSeconds,
} from '../../src/shared/lib/restDuration';
import { Icon } from '../../src/shared/components/Icon';
import { colors } from '../../src/shared/theme/colors';
import { textRoles } from '../../src/shared/theme/typography';
import type { Split, WorkoutCycle } from '../../src/features/splits/types';
import { DataBackupSection } from '../../src/features/settings/components/DataBackupSection';

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
  const insets = useSafeAreaInsets();
  const { cycle, isLoaded: cycleLoaded, loadCycle, resetCyclePosition } = useCycleStore();
  const { splits, isLoaded: splitsLoaded, loadData } = useSplitsStore();
  const {
    weightUnit,
    autoAdvanceCycle,
    defaultRestSeconds,
    isLoaded: prefsLoaded,
    loadPrefs,
    setWeightUnit,
    setAutoAdvanceCycle,
    setDefaultRestSeconds,
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
  // Sticky: stepping a custom value onto a preset (105 -> 120) should not yank
  // the stepper away mid-adjustment. Tapping a preset chip closes it.
  const [customRestOpen, setCustomRestOpen] = useState(false);
  const usingCustomRest = customRestOpen || !isRestPreset(defaultRestSeconds);

  const handleReset = useCallback(() => {
    if (!canReset) return;

    showDialog(
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
      <View
        className="px-5 pb-4"
        style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
      >
        <Text className={`text-text-primary ${textRoles.screenTitle}`}>Settings</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-8">
          <Text className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}>
            Units
          </Text>

          <View className="bg-surface-1 rounded-lg px-4 py-4 mb-8 flex-row items-center">
            <View className="flex-1 mr-3">
              <Text className={`text-text-primary ${textRoles.cardTitle}`}>Weight unit</Text>
              <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>
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
                <Text className={`font-sans ${textRoles.bodySmall} ${weightUnit === 'kg' ? 'text-surface-0' : 'text-text-secondary'}`}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-1.5 rounded ${weightUnit === 'lbs' ? 'bg-accent' : 'bg-surface-2'}`}
                onPress={() => weightUnit !== 'lbs' && setWeightUnit('lbs')}
                accessibilityLabel="Weight unit, pounds"
                activeOpacity={0.7}
              >
                <Text className={`font-sans ${textRoles.bodySmall} ${weightUnit === 'lbs' ? 'text-surface-0' : 'text-text-secondary'}`}>lbs</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}>
            Workout
          </Text>

          <View className="bg-surface-1 rounded-lg px-4 py-4 mb-8">
            <Text className={`text-text-primary ${textRoles.cardTitle}`}>Default rest between sets</Text>
            <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5 mb-3`}>
              Countdown starts after every logged set
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {REST_PRESETS.map((seconds) => (
                <TouchableOpacity
                  key={seconds}
                  className={`px-3 py-1.5 rounded ${!usingCustomRest && defaultRestSeconds === seconds ? 'bg-accent' : 'bg-surface-2'}`}
                  onPress={() => {
                    setCustomRestOpen(false);
                    if (defaultRestSeconds !== seconds) setDefaultRestSeconds(seconds);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !usingCustomRest && defaultRestSeconds === seconds }}
                  accessibilityLabel={`Default rest, ${seconds} seconds`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`font-sans ${textRoles.bodySmall} ${!usingCustomRest && defaultRestSeconds === seconds ? 'text-surface-0' : 'text-text-secondary'}`}
                  >
                    {seconds}s
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                className={`px-3 py-1.5 rounded ${usingCustomRest ? 'bg-accent' : 'bg-surface-2'}`}
                onPress={() => {
                  // Start from the current value so switching to custom does
                  // not jump the timer to some unrelated default.
                  if (!usingCustomRest) {
                    setDefaultRestSeconds(stepRestSeconds(defaultRestSeconds, REST_STEP_SECONDS));
                  }
                  setCustomRestOpen(true);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: usingCustomRest }}
                accessibilityLabel={
                  usingCustomRest
                    ? `Custom rest, ${defaultRestSeconds} seconds`
                    : 'Use a custom rest duration'
                }
                activeOpacity={0.7}
              >
                <Text
                  className={`font-sans ${textRoles.bodySmall} ${usingCustomRest ? 'text-surface-0' : 'text-text-secondary'}`}
                >
                  {usingCustomRest ? formatRestDuration(defaultRestSeconds) : 'Custom'}
                </Text>
              </TouchableOpacity>
            </View>

            {usingCustomRest && (
              <View className="flex-row items-center justify-between bg-surface-0 rounded-lg mt-3 px-2 py-2">
                <TouchableOpacity
                  className="bg-surface-2 rounded-md px-4 py-2"
                  onPress={() =>
                    setDefaultRestSeconds(stepRestSeconds(defaultRestSeconds, -REST_STEP_SECONDS))
                  }
                  disabled={defaultRestSeconds <= MIN_REST_SECONDS}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease rest by ${REST_STEP_SECONDS} seconds`}
                  accessibilityState={{ disabled: defaultRestSeconds <= MIN_REST_SECONDS }}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`${textRoles.buttonLabelSmall} ${defaultRestSeconds <= MIN_REST_SECONDS ? 'text-text-disabled' : 'text-text-primary'}`}
                  >
                    −{REST_STEP_SECONDS}s
                  </Text>
                </TouchableOpacity>

                <Text className={`text-accent ${textRoles.metricBody}`}>
                  {formatRestDuration(defaultRestSeconds)}
                </Text>

                <TouchableOpacity
                  className="bg-surface-2 rounded-md px-4 py-2"
                  onPress={() =>
                    setDefaultRestSeconds(stepRestSeconds(defaultRestSeconds, REST_STEP_SECONDS))
                  }
                  disabled={defaultRestSeconds >= MAX_REST_SECONDS}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase rest by ${REST_STEP_SECONDS} seconds`}
                  accessibilityState={{ disabled: defaultRestSeconds >= MAX_REST_SECONDS }}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`${textRoles.buttonLabelSmall} ${defaultRestSeconds >= MAX_REST_SECONDS ? 'text-text-disabled' : 'text-text-primary'}`}
                  >
                    +{REST_STEP_SECONDS}s
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}>
            Training Cycle
          </Text>

          <TouchableOpacity
            className="bg-surface-1 rounded-lg px-4 py-4 mb-3 flex-row items-center"
            onPress={() => router.push('/cycle')}
            accessibilityLabel="Edit training cycle"
            activeOpacity={0.7}
          >
            <View className="flex-1 mr-3">
              <Text className={`text-text-primary ${textRoles.cardTitle}`}>Edit Training Cycle</Text>
              <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>{cycleSummary}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="text-secondary" />
          </TouchableOpacity>

          <View className="bg-surface-1 rounded-lg px-4 py-4 mb-3 flex-row items-center">
            <View className="flex-1 mr-3">
              <Text className={`text-text-primary ${textRoles.cardTitle}`}>Auto-advance after workout</Text>
              <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>
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

          <DataBackupSection />

          {/* Destructive actions live in their own section rather than sitting
              inline with ordinary rows distinguished only by red text. */}
          <Text className={`text-danger ${textRoles.sectionLabel} mb-3`}>Danger zone</Text>

          <TouchableOpacity
            className={`bg-surface-1 rounded-lg px-4 py-4 flex-row items-center mb-8 ${!canReset ? 'opacity-40' : ''}`}
            style={{ borderWidth: 1, borderColor: 'rgba(255, 76, 76, 0.35)' }}
            onPress={handleReset}
            disabled={!canReset}
            accessibilityRole="button"
            accessibilityLabel="Reset cycle to day 1"
            accessibilityState={{ disabled: !canReset }}
            activeOpacity={0.7}
          >
            <Icon name="restart" size={20} color="danger" />
            <View className="flex-1 ml-3">
              <Text className={`text-danger ${textRoles.cardTitle}`}>Reset to Day 1</Text>
              <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>
                {canReset ? 'Start the cycle over from day 1' : 'Configure a cycle first'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
