import React, { useEffect, useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSplitsStore } from '../../../src/features/splits';
import { useHistory } from '../../../src/features/history';
import { ExerciseProgressRow } from '../../../src/features/progress/components/ExerciseProgressRow';
import { buildFirstSetSeries } from '../../../src/features/progress/lib/firstSetProgress';
import { getMetricValue } from '../../../src/features/progress/lib/chartMetric';
import { getSeriesTrend } from '../../../src/features/progress/lib/sparkline';
import { Icon } from '../../../src/shared/components/Icon';
import { textRoles } from '../../../src/shared/theme/typography';

export default function ProgressSplitExercisesScreen() {
  const { splitId } = useLocalSearchParams<{ splitId: string }>();
  const router = useRouter();
  const { isLoaded, loadData, getSplitById, getExercisesForSplit } = useSplitsStore();
  const { sessions, isLoaded: historyLoaded } = useHistory();

  useEffect(() => {
    if (!isLoaded) void loadData();
  }, [isLoaded, loadData]);

  const split = isLoaded ? getSplitById(splitId) : null;
  const exercises = useMemo(
    () => (isLoaded ? getExercisesForSplit(splitId) : []),
    [isLoaded, getExercisesForSplit, splitId],
  );

  // Preview each row with its est. 1RM series so the list says which lifts are
  // actually moving, rather than looking identical to the Splits list.
  const previews = useMemo(() => {
    const map: Record<string, { values: number[]; trend: ReturnType<typeof getSeriesTrend> }> = {};
    for (const exercise of exercises) {
      const values = buildFirstSetSeries(sessions, exercise.id, 'all').map((point) =>
        getMetricValue(point, 'e1rm'),
      );
      map[exercise.id] = { values, trend: getSeriesTrend(values) };
    }
    return map;
  }, [exercises, sessions]);

  if (!isLoaded || !historyLoaded) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center">
        <Text className={`text-text-secondary ${textRoles.body}`}>Loading...</Text>
      </View>
    );
  }

  if (!split) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center px-8">
        <Text className={`text-text-secondary ${textRoles.body} text-center`}>
          Split not found.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-0">
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View className="mb-6">
            <Text className={`text-text-primary ${textRoles.listTitle}`}>{split.name}</Text>
            <Text className={`text-text-secondary ${textRoles.bodySmall} mt-1`}>
              Trend is estimated 1RM across all logged sessions.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center px-8 pt-12">
            <Icon name="dumbbell" size={40} color="text-disabled" />
            <Text className={`text-text-secondary ${textRoles.body} text-center mt-4`}>
              Add exercises to this split first.
            </Text>
          </View>
        }
        renderItem={({ item: exercise }) => {
          const preview = previews[exercise.id] ?? { values: [], trend: null };
          return (
            <ExerciseProgressRow
              name={exercise.name}
              values={preview.values}
              trend={preview.trend}
              onPress={() =>
                router.push({
                  pathname: '/progress/exercise/[exerciseId]',
                  params: { exerciseId: exercise.id, splitId },
                })
              }
            />
          );
        }}
      />
    </View>
  );
}
