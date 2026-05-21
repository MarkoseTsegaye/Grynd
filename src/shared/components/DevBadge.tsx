import React from 'react';
import { View, Text } from 'react-native';

export function DevBadge() {
  if (process.env.APP_ENV !== 'development') return null;

  return (
    <View
      className="bg-surface-2 rounded-full px-2 py-0.5"
      style={{ position: 'absolute', bottom: 90, right: 16, zIndex: 999, pointerEvents: 'none' }}
    >
      <Text className="text-accent font-mono text-xs">DEV</Text>
    </View>
  );
}
