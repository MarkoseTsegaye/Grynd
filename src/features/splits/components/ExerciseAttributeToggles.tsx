import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { textRoles } from '../../../shared/theme/typography';

interface Props {
  unilateral: boolean;
  plateLoaded: boolean;
  onToggleUnilateral: () => void;
  onTogglePlateLoaded: () => void;
}

export function ExerciseAttributeToggles({
  unilateral,
  plateLoaded,
  onToggleUnilateral,
  onTogglePlateLoaded,
}: Props) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg items-center ${unilateral ? 'bg-accent' : 'bg-surface-2'}`}
          onPress={onToggleUnilateral}
          accessibilityRole="button"
          accessibilityState={{ selected: unilateral }}
          accessibilityLabel="Unilateral exercise"
          activeOpacity={0.7}
        >
          <Text
            className={`${textRoles.toggleLabel} ${unilateral ? 'text-surface-0' : 'text-text-secondary'}`}
          >
            Unilateral
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg items-center ${!unilateral ? 'bg-accent' : 'bg-surface-2'}`}
          onPress={() => {
            if (unilateral) onToggleUnilateral();
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: !unilateral }}
          accessibilityLabel="Regular bilateral exercise"
          activeOpacity={0.7}
        >
          <Text
            className={`${textRoles.toggleLabel} ${!unilateral ? 'text-surface-0' : 'text-text-secondary'}`}
          >
            Regular
          </Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg items-center ${plateLoaded ? 'bg-accent' : 'bg-surface-2'}`}
          onPress={onTogglePlateLoaded}
          accessibilityRole="button"
          accessibilityState={{ selected: plateLoaded }}
          accessibilityLabel="Plate loaded exercise"
          activeOpacity={0.7}
        >
          <Text
            className={`${textRoles.toggleLabel} ${plateLoaded ? 'text-surface-0' : 'text-text-secondary'}`}
          >
            Plate loaded
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg items-center ${!plateLoaded ? 'bg-accent' : 'bg-surface-2'}`}
          onPress={() => {
            if (plateLoaded) onTogglePlateLoaded();
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: !plateLoaded }}
          accessibilityLabel="Regular weight entry"
          activeOpacity={0.7}
        >
          <Text
            className={`${textRoles.toggleLabel} ${!plateLoaded ? 'text-surface-0' : 'text-text-secondary'}`}
          >
            Regular
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
