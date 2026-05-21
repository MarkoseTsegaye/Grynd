import React from 'react';
import { View, TextInput, Text } from 'react-native';

interface NumericInputProps {
  value: string;
  onChangeText: (val: string) => void;
  placeholder?: string;
  suffix?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  keyboardType?: 'decimal-pad' | 'number-pad';
  returnKeyType?: 'done' | 'next';
  maxLength?: number;
  accessibilityLabel?: string;
}

export const NumericInput = React.forwardRef<TextInput, NumericInputProps>(
  (
    {
      value,
      onChangeText,
      placeholder,
      suffix,
      autoFocus,
      onSubmitEditing,
      keyboardType = 'decimal-pad',
      returnKeyType = 'done',
      maxLength = 6,
      accessibilityLabel,
    },
    ref,
  ) => {
    return (
      <View className="flex-row items-center bg-surface-2 rounded-lg px-4 py-4">
        <TextInput
          ref={ref}
          className="text-text-primary font-mono-bold text-4xl flex-1"
          keyboardType={keyboardType}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? '0'}
          placeholderTextColor="#3D3B38"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
          textAlignVertical="center"
          style={{ paddingTop: 0 }}
          maxLength={maxLength}
          accessibilityLabel={accessibilityLabel}
        />
        {suffix ? (
          <Text className="text-text-secondary font-sans text-sm ml-1">{suffix}</Text>
        ) : null}
      </View>
    );
  },
);
