import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSplitsList } from '../../src/features/splits';
import { useSplitsStore } from '../../src/features/splits';
import { Icon } from '../../src/shared/components/Icon';
import { textRoles } from '../../src/shared/theme/typography';

export default function ProgressTabScreen() {
  const router = useRouter();
  const { splits, isLoaded } = useSplitsList();
  const { getExercisesForSplit, loadData } = useSplitsStore();

  useEffect(() => {
    if (!isLoaded) void loadData();
  }, [isLoaded, loadData]);

  if (!isLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  return (
    <View className="flex-1 bg-surface-0">
      <View className="px-5 pt-14 pb-4">
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
                  Total kg·reps across all sessions
                </Text>
              </View>
            </View>
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
              accessibilityLabel={`${split.name}, ${count} exercises`}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <View className="flex-1 pr-3">
                <Text className={`text-text-primary ${textRoles.listItemTitle}`}>{split.name}</Text>
                <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
                  {count} {count === 1 ? 'exercise' : 'exercises'}
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
