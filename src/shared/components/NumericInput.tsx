import React, { useCallback } from 'react';
import { View, TextInput, Text, Platform } from 'react-native';
import type { TextInputProps } from 'react-native';
import { sanitizeIntegerInput } from '../lib/weight';
import { textRoles, typography } from '../theme/typography';

type NumericInputSize = 'default' | 'compact';

const sizeConfig = {
  default: {
    container: 'min-h-16 px-4',
    inputClass: textRoles.inputValue,
    lineHeight: typography.lineHeights['4xl'],
    suffixClass: `${textRoles.inputSuffix} ml-1.5`,
  },
  compact: {
    container: 'min-h-10 px-2',
    inputClass: textRoles.inputValueCompact,
    lineHeight: typography.lineHeights['2xl'],
    suffixClass: `${textRoles.inputSuffixCompact} ml-1`,
  },
} as const;

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
  size?: NumericInputSize;
  integerOnly?: boolean;
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
      keyboardType = 'number-pad',
      returnKeyType = 'done',
      maxLength = 6,
      accessibilityLabel,
      InputComponent = TextInput,
      size = 'default',
      integerOnly = true,
    },
    ref,
  ) => {
    const Input = (InputComponent ?? TextInput) as typeof TextInput;
    const config = sizeConfig[size];

    const handleChangeText = useCallback(
      (text: string) => {
        onChangeText(integerOnly ? sanitizeIntegerInput(text) : text);
      },
      [integerOnly, onChangeText],
    );

    return (
      <View className={`flex-row items-center justify-center bg-surface-2 rounded-lg ${config.container}`}>
        <Input
          ref={ref}
          className={`text-text-primary font-mono-bold flex-1 ${config.inputClass}`}
          keyboardType={keyboardType}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder ?? '0'}
          placeholderTextColor="#3D3B38"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
          autoFocus={autoFocus}
          textAlignVertical="center"
          textAlign={size === 'compact' ? 'center' : 'left'}
          style={{
            lineHeight: config.lineHeight,
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
          }}
          maxLength={maxLength}
          accessibilityLabel={accessibilityLabel}
        />
        {suffix ? (
          <Text className={`text-text-secondary font-sans ${config.suffixClass}`}>{suffix}</Text>
        ) : null}
      </View>
    );
  },
);
