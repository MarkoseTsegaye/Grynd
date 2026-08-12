import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useExerciseProgress } from '../../../src/features/progress/hooks/useExerciseProgress';
import { FirstSetSummary } from '../../../src/features/progress/components/FirstSetSummary';
import { FirstSetLineChart } from '../../../src/features/progress/components/FirstSetLineChart';
import { CHART_METRIC_OPTIONS } from '../../../src/features/progress/lib/chartMetric';
import { Icon } from '../../../src/shared/components/Icon';
import { textRoles } from '../../../src/shared/theme/typography';

export default function ExerciseProgressScreen() {
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
    rangeAvailability,
    metric,
    setMetric,
    weightUnit,
  } = useExerciseProgress(useLocalSearchParams<{ exerciseId: string }>().exerciseId);

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
      <Text className={`text-text-secondary ${textRoles.bodySmall} mb-5`}>
        First set over time
      </Text>

      {/* Metric — plotting est. 1RM is what makes a rep-only gain visible */}
      <View className="flex-row bg-surface-1 rounded-lg p-1 mb-3">
        {CHART_METRIC_OPTIONS.map((option) => {
          const selected = metric === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              className={`flex-1 h-9 rounded-md items-center justify-center ${selected ? 'bg-accent' : ''}`}
              onPress={() => setMetric(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Plot ${option.label}`}
              activeOpacity={0.7}
            >
              <Text
                className={`${textRoles.toggleLabel} ${selected ? 'text-surface-0' : 'text-text-secondary'}`}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Ranges — empty ones are subdued and unpickable rather than silently blank */}
      <View className="flex-row flex-wrap gap-2 mb-6">
        {rangeAvailability.map((range) => {
          const selected = rangeId === range.id;
          return (
            <TouchableOpacity
              key={range.id}
              className={`px-3 py-1.5 rounded ${selected ? 'bg-accent' : 'bg-surface-2'} ${range.hasData ? '' : 'opacity-40'}`}
              onPress={() => setRangeId(range.id)}
              disabled={!range.hasData}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !range.hasData }}
              accessibilityLabel={
                range.hasData
                  ? `Show last ${range.label}, ${range.count} ${range.count === 1 ? 'session' : 'sessions'}`
                  : `Last ${range.label}, no sessions`
              }
              activeOpacity={0.7}
            >
              <Text
                className={`${selected ? 'text-surface-0' : 'text-text-secondary'} ${textRoles.toggleLabel}`}
              >
                {range.label}
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
            {metric === 'e1rm' ? 'ESTIMATED 1RM OVER TIME' : 'WEIGHT OVER TIME'}
          </Text>
          <FirstSetLineChart
            points={points}
            metric={metric}
            weightUnit={weightUnit}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
          />
        </>
      )}
    </ScrollView>
  );
}
