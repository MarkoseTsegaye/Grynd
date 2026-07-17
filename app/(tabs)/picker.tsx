import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePicker } from 'react-native-any-picker';
import { colors } from '../../src/shared/theme/colors';
import { textRoles, typography } from '../../src/shared/theme/typography';

const gryndTheme = {
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

export default function PickerScreen() {
  const [expiry, setExpiry] = useState(new Date());

  const mm = String(expiry.getMonth() + 1).padStart(2, '0');
  const yy = String(expiry.getFullYear()).slice(-2);

  return (
    <SafeAreaView className="flex-1 bg-surface-0">
      <View className="px-5 pt-6 pb-2">
        <Text className={`text-text-primary ${textRoles.screenTitle} mb-1`}>
          Expiry Date
        </Text>
        <Text className={`text-text-secondary ${textRoles.bodySmall}`}>
          MM / YY
        </Text>
      </View>

      <View className="px-5 pt-6">
        <View className="bg-surface-1 rounded-2xl px-6 py-5 items-center mb-6">
          <Text className={`text-accent ${textRoles.metricDisplay} tracking-widest`}>
            {mm} / {yy}
          </Text>
        </View>

        <View className="bg-surface-1 rounded-2xl overflow-hidden">
          <DatePicker
            value={expiry}
            onChange={setExpiry}
            format="MM/YY"
            theme={gryndTheme}
            columnWidths={{ month: 100, year: 100 }}
            style={{ height: 200, width: 'auto', justifyContent: 'space-evenly' }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
