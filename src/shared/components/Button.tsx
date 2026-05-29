import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { textRoles } from '../theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled, accessibilityLabel }: Props) {
  const base = 'items-center justify-center rounded-lg px-6 py-4';
  const variants = {
    primary: 'bg-accent',
    ghost: 'bg-surface-2 border border-text-disabled',
    danger: 'bg-danger',
  };
  const textVariants = {
    primary: `text-surface-0 ${textRoles.buttonLabel}`,
    ghost: `text-text-primary ${textRoles.buttonLabelMedium}`,
    danger: `text-text-primary ${textRoles.buttonLabel}`,
  };

  return (
    <TouchableOpacity
      className={`${base} ${variants[variant]} ${disabled ? 'opacity-40' : ''}`}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      activeOpacity={0.7}
    >
      <Text className={textVariants[variant]}>{label}</Text>
    </TouchableOpacity>
  );
}
