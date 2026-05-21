import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import type { Split } from '../types';

interface Props {
  split: Split;
  exerciseCount: number;
  /** Home tab: whole card starts workout */
  onPress?: () => void;
  /** Splits tab: edit icon */
  onManage?: () => void;
  /** Splits tab: delete icon */
  onDelete?: () => void;
}

export function SplitCard({ split, exerciseCount, onPress, onManage, onDelete }: Props) {
  const isStartMode = !!onPress && !onManage;

  const inner = (
    <View className="bg-surface-1 rounded-lg px-4 py-4 mb-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-text-primary font-sans-bold text-base" numberOfLines={1}>
            {split.name}
          </Text>
          <Text className="text-text-secondary font-sans text-xs mt-0.5">
            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
          </Text>
        </View>
        {isStartMode ? (
          <Icon name="play-circle-outline" size={20} color="accent" />
        ) : (
          <View className="flex-row gap-3 items-center">
            {onManage && (
              <TouchableOpacity
                onPress={onManage}
                accessibilityLabel={`Edit ${split.name}`}
                activeOpacity={0.7}
              >
                <Icon name="pencil-outline" size={20} color="text-secondary" />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={onDelete}
                accessibilityLabel={`Delete ${split.name}`}
                activeOpacity={0.7}
              >
                <Icon name="trash-can-outline" size={20} color="text-secondary" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityLabel={`Start ${split.name} workout`}
        activeOpacity={0.7}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}
