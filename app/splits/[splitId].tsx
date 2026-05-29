import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useManageSplit } from '../../src/features/splits';
import { useSplitsStore } from '../../src/features/splits';
import { Icon } from '../../src/shared/components/Icon';
import type { Exercise } from '../../src/features/splits/types';
import { textRoles } from '../../src/shared/theme/typography';

export default function ManageSplitScreen() {
  const { splitId } = useLocalSearchParams<{ splitId: string }>();
  const { reorderExercises } = useSplitsStore();
  const {
    split, exercises, newExerciseName, setNewExerciseName,
    isAdding, error, handleAddExercise, handleRemoveExercise,
  } = useManageSplit(splitId);

  if (!split) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center">
        <Text className={`text-text-secondary ${textRoles.body}`}>Split not found.</Text>
      </View>
    );
  }

  function renderItem({ item: exercise, drag, isActive }: { item: Exercise; drag: () => void; isActive: boolean }) {
    return (
      <ScaleDecorator>
        <View className={`flex-row items-center bg-surface-2 rounded-lg mb-2 ${isActive ? 'opacity-80' : ''}`}>
          <TouchableOpacity onLongPress={drag} delayLongPress={150} className="px-3 py-4" accessibilityLabel="Drag to reorder exercise">
            <Icon name="drag-vertical" size={24} color="text-secondary" />
          </TouchableOpacity>
          <View className="flex-1 py-3">
            <Text className={`text-text-primary ${textRoles.listItemTitle}`}>{exercise.name}</Text>
            {exercise.notes ? (
              <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>{exercise.notes}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => handleRemoveExercise(exercise.id)}
            accessibilityLabel={`Remove ${exercise.name}`}
            className="px-4 py-4"
            activeOpacity={0.7}
          >
            <Text className={`text-danger ${textRoles.cardTitle}`}>×</Text>
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    );
  }

  return (
    <View className="flex-1 bg-surface-0">
      <View className="px-5 pt-4 pb-2">
        <Text className={`text-text-primary ${textRoles.screenTitle} mb-1`} numberOfLines={2}>{split.name}</Text>
        <Text className={`text-text-secondary ${textRoles.caption} mb-6`}>
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
        </Text>

        <View className="flex-row gap-2 mb-6">
          <TextInput
            className={`flex-1 bg-surface-2 text-text-primary ${textRoles.body} rounded-lg px-4 py-3`}
            placeholder="Exercise name"
            placeholderTextColor="#3D3B38"
            value={newExerciseName}
            onChangeText={setNewExerciseName}
            returnKeyType="done"
            onSubmitEditing={handleAddExercise}
            accessibilityLabel="New exercise name"
          />
          <TouchableOpacity
            className={`bg-accent rounded-lg px-4 items-center justify-center ${isAdding || !newExerciseName.trim() ? 'opacity-40' : ''}`}
            onPress={handleAddExercise}
            disabled={isAdding || !newExerciseName.trim()}
            accessibilityLabel="Add exercise"
            activeOpacity={0.7}
          >
            <Icon name="plus" size={20} color="surface-0" />
          </TouchableOpacity>
        </View>

        {error ? <Text className={`text-danger ${textRoles.bodySmall} mb-4`}>{error}</Text> : null}
      </View>

      {exercises.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className={`text-text-disabled ${textRoles.body}`}>No exercises yet.</Text>
        </View>
      ) : (
        <DraggableFlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorderExercises(splitId, data.map((e) => e.id))}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        />
      )}
    </View>
  );
}
