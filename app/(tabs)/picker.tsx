import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePicker } from 'react-native-any-picker';

// iOS-style light theme matching the reference screenshot
const iosTheme = {
  colors: {
    text: '#1C1C1E',           // iOS dark label
    border: 'transparent',     // no visible divider lines
    indicator: 'rgba(0,0,0,0.06)', // barely-there selection band, same as iOS
    background: '#F2F2F7',     // iOS system grouped background
  },
  fonts: {
    size: { xl: 28, lg: 18, base: 15, sm: 12 },
    family: 'System',
  },
};


export default function PickerScreen() {
  const [expiry, setExpiry] = useState(new Date());

  const mm = String(expiry.getMonth() + 1).padStart(2, '0');
  const yy = String(expiry.getFullYear()).slice(-2);

  return (
    <SafeAreaView className="flex-1 bg-surface-0">
      <View className="px-5 pt-6 pb-2">
        <Text className="text-text-primary font-sans-bold text-2xl mb-1">
          Expiry Date
        </Text>
        <Text className="text-text-secondary font-sans text-sm">
          MM / YY
        </Text>
      </View>

      <View className="px-5 pt-6">
        {/* Live display */}
        <View className="bg-surface-1 rounded-2xl px-6 py-5 items-center mb-6">
          <Text className="text-accent font-mono-bold text-5xl tracking-widest">
            {mm} / {yy}
          </Text>
        </View>

        {/* MM / YY picker — two columns only */}
        <View style={{ borderRadius: 16, overflow: 'hidden' }}>
          <DatePicker
            value={expiry}
            onChange={setExpiry}
            format="MM/YY"
            theme={iosTheme}
            columnWidths={{ month: 100, year: 100 }}
            style={{ height: 200, width: 'auto', justifyContent: 'space-evenly' }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
