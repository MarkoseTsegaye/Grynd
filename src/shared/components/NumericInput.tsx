import React, { useCallback } from 'react';
import { View, TextInput, Text, Platform } from 'react-native';
import type { TextInputProps } from 'react-native';
import { sanitizeIntegerInput } from '../lib/weight';
import { colors } from '../theme/colors';
import { textRoles, typography } from '../theme/typography';

type NumericInputSize = 'default' | 'compact';

const sizeConfig = {
  default: {
    container: 'min-h-16 px-4',
    inputClass: textRoles.inputValue,
    fontSize: typography.sizes['4xl'],
    lineHeight: typography.lineHeights['4xl'],
    suffixClass: `${textRoles.inputSuffix} ml-1.5`,
  },
  compact: {
    container: 'min-h-10 px-2',
    inputClass: textRoles.inputValueCompact,
    fontSize: typography.sizes['2xl'],
    lineHeight: typography.lineHeights['2xl'],
    suffixClass: `${textRoles.inputSuffixCompact} ml-1`,
  },
} as const;

/**
 * On web, NativeWind's className styles don't reliably propagate to the
 * underlying `<input>` element when TextInput is wrapped (e.g. via
 * BottomSheetTextInput → gesture-handler's TextInput → react-native-web's
 * TextInput). Result: iOS Safari's default input styles win, and typed
 * values render as tiny black text instead of the big white numbers the
 * container expects. Passing font size, color, and family through the
 * inline `style` prop bypasses that chain and guarantees the styles land.
 */
const isWeb = Platform.OS === 'web';

interface NumericInputProps {
  value: string;
  onChangeText: (val: string) => void;
  placeholder?: string;
  suffix?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  onFocus?: TextInputProps['onFocus'];
  onBlur?: TextInputProps['onBlur'];
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
      onBlur,
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
          onBlur={onBlur}
          autoFocus={autoFocus}
          textAlignVertical="center"
          textAlign={size === 'compact' ? 'center' : 'left'}
          style={{
            lineHeight: config.lineHeight,
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
            ...(isWeb
              ? {
                  fontSize: config.fontSize,
                  color: colors['text-primary'],
                  fontFamily: typography.fonts.monoBold,
                  // NativeWind's `flex-1` on className can drop when passed
                  // through the BottomSheetTextInput → gesture-handler →
                  // react-native-web wrapper chain, leaving the underlying
                  // <input> at its default browser width. That makes the
                  // WEIGHT input sit narrow inside its column and the
                  // adjacent REPS column's tap target overlaps into it.
                  // Force fill-width explicitly on web.
                  flex: 1,
                  minWidth: 0,
                  width: '100%',
                }
              : {}),
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
