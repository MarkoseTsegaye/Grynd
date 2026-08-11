import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/** Shared 3×4 numeric keypad. Emits '0'–'9', '.', or 'del'. */
export function NumberPad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {KEYS.map((key) => (
        <TouchableOpacity
          key={key}
          className="bg-surface-1 rounded-lg items-center justify-center"
          style={{ width: '31.5%', height: 48, flexGrow: 1 }}
          onPress={() => onKey(key)}
          accessibilityRole="button"
          accessibilityLabel={key === 'del' ? 'Delete' : key === '.' ? 'Decimal point' : key}
          activeOpacity={0.6}
        >
          {key === 'del' ? (
            <Icon name="backspace-outline" size={20} color="text-secondary" />
          ) : (
            <Text className={`text-text-primary ${textRoles.metricLarge}`}>{key}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Append/erase a keypad digit against a string field. */
export function applyKey(
  current: string,
  key: string,
  opts: { decimal: boolean; maxLen: number },
): string {
  if (key === 'del') return current.slice(0, -1);
  if (key === '.') {
    if (!opts.decimal || current.includes('.')) return current;
    return current === '' ? '0.' : current + '.';
  }
  if (current.length >= opts.maxLen) return current;
  if (current === '0') return key; // replace a lone leading zero
  return current + key;
}
