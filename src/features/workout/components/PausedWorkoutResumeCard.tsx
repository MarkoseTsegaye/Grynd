import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';

interface PausedWorkoutResumeCardProps {
  splitName: string;
  onResume: () => void;
}

export function PausedWorkoutResumeCard({ splitName, onResume }: PausedWorkoutResumeCardProps) {
  return (
    <View className="mx-5 mb-4 bg-surface-1 rounded-xl px-4 py-4">
      <Text className={`text-text-secondary ${textRoles.sectionLabelCompact} mb-1`}>
        PAUSED WORKOUT
      </Text>
      <Text className={`text-text-primary ${textRoles.listTitle} mb-3`} numberOfLines={1}>
        {splitName}
      </Text>
      <TouchableOpacity
        className="bg-accent rounded-lg py-3 flex-row items-center justify-center gap-2"
        onPress={onResume}
        accessibilityLabel="Resume paused workout"
        activeOpacity={0.7}
      >
        <Icon name="play-circle-outline" size={20} color="surface-0" />
        <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>Resume {splitName}</Text>
      </TouchableOpacity>
    </View>
  );
}
