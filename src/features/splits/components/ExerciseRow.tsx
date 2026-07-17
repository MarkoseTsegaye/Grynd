import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { textRoles } from '../../../shared/theme/typography';
import type { Exercise } from '../types';

interface Props {
  exercise: Exercise;
  index: number;
  onRemove: () => void;
}

export function ExerciseRow({ exercise, index, onRemove }: Props) {
  return (
    <View className="flex-row items-center bg-surface-2 rounded-lg px-4 py-3 mb-2">
      <Text className={`text-text-secondary ${textRoles.metric} w-8`}>{index + 1}</Text>
      <View className="flex-1">
        <Text className={`text-text-primary ${textRoles.listItemTitle}`}>{exercise.name}</Text>
        {exercise.notes ? (
          <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>{exercise.notes}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onRemove}
        accessibilityLabel={`Remove ${exercise.name}`}
        className="ml-3 px-2 py-1"
        activeOpacity={0.7}
      >
        <Text className={`text-danger ${textRoles.body}`}>×</Text>
      </TouchableOpacity>
    </View>
  );
}
