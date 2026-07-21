import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSplitsStore } from '../../../src/features/splits';
import { Icon } from '../../../src/shared/components/Icon';
import { textRoles } from '../../../src/shared/theme/typography';

export default function ProgressSplitExercisesScreen() {
  const { splitId } = useLocalSearchParams<{ splitId: string }>();
  const router = useRouter();
  const { isLoaded, loadData, getSplitById, getExercisesForSplit } = useSplitsStore();

  useEffect(() => {
    if (!isLoaded) void loadData();
  }, [isLoaded, loadData]);

  if (!isLoaded) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center">
        <Text className={`text-text-secondary ${textRoles.body}`}>Loading...</Text>
      </View>
    );
  }

  const split = getSplitById(splitId);
  const exercises = getExercisesForSplit(splitId);

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
              Choose an exercise to see first-set progress.
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
        renderItem={({ item: exercise }) => (
          <TouchableOpacity
            className="flex-row items-center justify-between bg-surface-1 rounded-lg px-4 py-4 mb-3"
            onPress={() =>
              router.push({
                pathname: '/progress/exercise/[exerciseId]',
                params: { exerciseId: exercise.id, splitId },
              })
            }
            accessibilityLabel={`View progress for ${exercise.name}`}
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Text className={`text-text-primary ${textRoles.listItemTitle} flex-1 pr-3`}>
              {exercise.name}
            </Text>
            <Icon name="chevron-right" size={22} color="text-secondary" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
