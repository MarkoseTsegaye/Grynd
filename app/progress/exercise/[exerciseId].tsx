import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useExerciseProgress } from '../../../src/features/progress/hooks/useExerciseProgress';
import { FirstSetSummary } from '../../../src/features/progress/components/FirstSetSummary';
import { FirstSetLineChart } from '../../../src/features/progress/components/FirstSetLineChart';
import { PROGRESS_RANGE_OPTIONS } from '../../../src/features/progress/lib/firstSetProgress';
import { Icon } from '../../../src/shared/components/Icon';
import { textRoles } from '../../../src/shared/theme/typography';

export default function ExerciseProgressScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const {
    isLoaded,
    exercise,
    points,
    selectedIndex,
    setSelectedIndex,
    selectedPoint,
    trend,
    personalBest,
    rangeId,
    setRangeId,
    weightUnit,
  } = useExerciseProgress(exerciseId);

  if (!isLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  if (!exercise) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center px-8">
        <Text className={`text-text-secondary ${textRoles.body} text-center`}>
          Exercise not found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-surface-0"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}
    >
      <Text className={`text-text-primary ${textRoles.listTitle} mb-1`}>{exercise.name}</Text>
      <Text className={`text-text-secondary ${textRoles.bodySmall} mb-6`}>
        First set over time
      </Text>

      <View className="flex-row flex-wrap gap-2 mb-6">
        {PROGRESS_RANGE_OPTIONS.map((option) => {
          const selected = rangeId === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              className={`px-3 py-1.5 rounded ${selected ? 'bg-accent' : 'bg-surface-2'}`}
              onPress={() => setRangeId(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show last ${option.label}`}
              activeOpacity={0.7}
            >
              <Text
                className={`${selected ? 'text-surface-0' : 'text-text-secondary'} ${textRoles.toggleLabel}`}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {points.length === 0 ? (
        <View className="items-center justify-center px-6 py-16">
          <Icon name="chart-line" size={48} color="text-disabled" />
          <Text className={`text-text-secondary ${textRoles.body} text-center mt-4`}>
            No first sets in this range yet.{'\n'}Log this exercise in a workout to unlock progress.
          </Text>
        </View>
      ) : (
        <>
          {selectedPoint ? (
            <FirstSetSummary
              point={selectedPoint}
              trend={selectedIndex === points.length - 1 ? trend : null}
              isPersonalBest={selectedIndex === points.length - 1 ? personalBest : false}
              weightUnit={weightUnit}
              showTrendHint={selectedIndex === points.length - 1}
            />
          ) : null}

          <Text className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}>
            WEIGHT OVER TIME
          </Text>
          <FirstSetLineChart
            points={points}
            weightUnit={weightUnit}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
          />
        </>
      )}
    </ScrollView>
  );
}
