import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSplitsList } from '../../src/features/splits';
import { useSplitsStore } from '../../src/features/splits';
import { useHistory } from '../../src/features/history';
import { usePrefsStore } from '../../src/shared/store/prefsStore';
import { Sparkline } from '../../src/features/progress/components/Sparkline';
import {
  buildVolumeSeries,
  formatVolumeAbbreviated,
  getVolumeInLastDays,
} from '../../src/features/progress/lib/sessionVolume';
import { getSeriesTrend } from '../../src/features/progress/lib/sparkline';
import { getSplitActivity } from '../../src/features/splits/lib/splitActivity';
import { kgToLbs } from '../../src/shared/lib/weight';
import { Icon } from '../../src/shared/components/Icon';
import { textRoles } from '../../src/shared/theme/typography';

export default function ProgressTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { splits, isLoaded } = useSplitsList();
  const { getExercisesForSplit, loadData } = useSplitsStore();
  const { sessions, isLoaded: historyLoaded } = useHistory();
  const { weightUnit } = usePrefsStore();

  useEffect(() => {
    if (!isLoaded) void loadData();
  }, [isLoaded, loadData]);

  const toDisplay = (kg: number) => (weightUnit === 'lbs' ? kgToLbs(kg) : kg);

  // The volume card used to state what it would show without showing any of
  // it. Preview the series and the recent total so it earns its place.
  const volume = useMemo(() => {
    const series = buildVolumeSeries(sessions).map((point) => point.volume);
    return {
      values: series,
      trend: getSeriesTrend(series),
      recentTotal: formatVolumeAbbreviated(toDisplay(getVolumeInLastDays(sessions, 7))),
    };
  }, [sessions, weightUnit]);

  const activityBySplit = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const split of splits) map[split.id] = getSplitActivity(sessions, split.id).label;
    return map;
  }, [splits, sessions]);

  if (!isLoaded || !historyLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  return (
    <View className="flex-1 bg-surface-0">
      <View
        className="px-5 pb-4"
        style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
      >
        <Text className={`text-text-primary ${textRoles.screenTitle}`}>Progress</Text>
      </View>

      <FlatList
        data={splits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        ListHeaderComponent={
          <TouchableOpacity
            className="flex-row items-center justify-between bg-surface-1 rounded-lg px-4 py-4 mb-6"
            onPress={() => router.push('/progress/volume')}
            accessibilityLabel="View workout volume over time"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <Icon name="chart-line" size={22} color="accent" />
              <View className="flex-1">
                <Text className={`text-text-primary ${textRoles.listItemTitle}`}>
                  Workout volume
                </Text>
                <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
                  {volume.values.length > 0
                    ? `${volume.recentTotal} ${weightUnit === 'lbs' ? 'lb' : 'kg'}·reps in the last 7 days`
                    : `Total ${weightUnit === 'lbs' ? 'lb' : 'kg'}·reps across all sessions`}
                </Text>
              </View>
            </View>
            {volume.values.length > 1 && (
              <Sparkline values={volume.values} tone={volume.trend?.direction ?? 'flat'} />
            )}
            <Icon name="chevron-right" size={22} color="text-secondary" />
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View className="items-center justify-center px-8 pt-16">
            <Icon name="dumbbell" size={48} color="text-disabled" />
            <Text className={`text-text-secondary ${textRoles.body} text-center mt-4`}>
              Create a split with exercises to track progress.
            </Text>
          </View>
        }
        ListHeaderComponentStyle={splits.length === 0 ? { marginBottom: 0 } : undefined}
        renderItem={({ item: split }) => {
          const count = getExercisesForSplit(split.id).length;
          return (
            <TouchableOpacity
              className="flex-row items-center justify-between bg-surface-1 rounded-lg px-4 py-4 mb-3"
              onPress={() => router.push(`/progress/split/${split.id}`)}
              accessibilityLabel={`${split.name}, ${count} exercises${activityBySplit[split.id] ? `, last performed ${activityBySplit[split.id]}` : ', never performed'}`}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <View className="flex-1 pr-3">
                <Text className={`text-text-primary ${textRoles.listItemTitle}`}>{split.name}</Text>
                <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
                  {count} {count === 1 ? 'exercise' : 'exercises'}
                  {activityBySplit[split.id] ? ` · ${activityBySplit[split.id]}` : ''}
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color="text-secondary" />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
