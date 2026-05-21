import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

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
    primary: 'text-surface-0 font-sans-bold text-base',
    ghost: 'text-text-primary font-sans-medium text-base',
    danger: 'text-text-primary font-sans-bold text-base',
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
