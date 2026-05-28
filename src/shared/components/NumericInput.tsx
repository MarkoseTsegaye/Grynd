import React from 'react';
import { View, TextInput, Text } from 'react-native';
import type { TextInputProps } from 'react-native';

interface NumericInputProps {
  value: string;
  onChangeText: (val: string) => void;
  placeholder?: string;
  suffix?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  onFocus?: TextInputProps['onFocus'];
  keyboardType?: 'decimal-pad' | 'number-pad';
  returnKeyType?: 'done' | 'next';
  maxLength?: number;
  accessibilityLabel?: string;
  InputComponent?: React.ElementType<TextInputProps>;
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
      onFocus,
      keyboardType = 'decimal-pad',
      returnKeyType = 'done',
      maxLength = 6,
      accessibilityLabel,
      InputComponent = TextInput,
    },
    ref,
  ) => {
    const Input = (InputComponent ?? TextInput) as typeof TextInput;

    return (
      <View className="flex-row items-center bg-surface-2 rounded-lg px-4 py-4">
        <Input
          ref={ref}
          className="text-text-primary font-mono-bold text-4xl flex-1"
          keyboardType={keyboardType}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? '0'}
          placeholderTextColor="#3D3B38"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
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
