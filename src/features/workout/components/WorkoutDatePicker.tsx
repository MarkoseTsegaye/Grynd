import React from 'react';
import { View, Text } from 'react-native';
import { DatePicker } from 'react-native-any-picker';
import { formatDisplayDate } from '../../../shared/lib/date';
import { textRoles, typography } from '../../../shared/theme/typography';
import { colors } from '../../../shared/theme/colors';

const darkTheme = {
  colors: {
    text: colors['text-primary'],
    border: 'transparent',
    indicator: 'rgba(255,255,255,0.08)',
    background: colors['surface-1'],
  },
  fonts: {
    size: {
      xl: typography.sizes['2xl'],
      lg: typography.sizes.base,
      base: typography.sizes.sm,
      sm: typography.sizes.xs,
    },
    family: typography.fonts.sans,
  },
};

interface Props {
  value: Date;
  onChange: (date: Date) => void;
}

export function WorkoutDatePicker({ value, onChange }: Props) {
  return (
    <View>
      <View className="bg-surface-1 rounded-2xl px-6 py-4 items-center mb-4">
        <Text className={`text-accent ${textRoles.cardTitleSmall}`}>
          {formatDisplayDate(value)}
        </Text>
      </View>

      <View className="bg-surface-1 rounded-2xl overflow-hidden">
        <DatePicker
          value={value}
          onChange={onChange}
          format="MMM/DD/YYYY"
          theme={darkTheme}
          style={{ height: 200, width: 'auto', justifyContent: 'space-evenly' }}
        />
      </View>
    </View>
  );
}
