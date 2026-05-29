import React from 'react';
import { View, Text } from 'react-native';
import { textRoles } from '../theme/typography';

interface Props {
  label: string;
  variant?: 'default' | 'accent' | 'success' | 'danger';
}

export function Badge({ label, variant = 'default' }: Props) {
  const variants = {
    default: 'bg-surface-2',
    accent: 'bg-accent',
    success: 'bg-success',
    danger: 'bg-danger',
  };
  const textVariants = {
    default: 'text-text-secondary',
    accent: 'text-surface-0',
    success: 'text-surface-0',
    danger: 'text-text-primary',
  };

  return (
    <View className={`${variants[variant]} rounded px-3 py-1`}>
      <Text className={`${textVariants[variant]} ${textRoles.badge}`}>{label}</Text>
    </View>
  );
}
