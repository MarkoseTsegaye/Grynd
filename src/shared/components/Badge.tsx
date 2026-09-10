import React from 'react';
import { View, Text } from 'react-native';
import { textRoles } from '../theme/typography';

interface Props {
  label: string;
  variant?: 'default' | 'accent' | 'success' | 'danger' | 'warning' | 'outline';
  /**
   * `sm` is the 10 px inline tag used beside a title (TODAY, PR).
   * `md` is the standalone badge.
   */
  size?: 'md' | 'sm';
}

const VARIANTS = {
  default: { frame: 'bg-surface-2', text: 'text-text-secondary' },
  accent: { frame: 'bg-accent', text: 'text-surface-0' },
  success: { frame: 'bg-success', text: 'text-surface-0' },
  danger: { frame: 'bg-danger', text: 'text-text-primary' },
  warning: { frame: 'bg-warning', text: 'text-surface-0' },
  outline: { frame: 'border border-text-disabled', text: 'text-text-secondary' },
} as const;

export function Badge({ label, variant = 'default', size = 'md' }: Props) {
  const v = VARIANTS[variant];
  const isSmall = size === 'sm';

  return (
    <View className={`${v.frame} ${isSmall ? 'rounded px-1.5 py-0.5' : 'rounded px-3 py-1'}`}>
      <Text
        className={`${v.text} ${isSmall ? textRoles.captionBold : textRoles.badge}`}
        // 10px is below the type scale's floor on purpose: this is a tag
        // riding alongside a title, not readable copy, and 14px would
        // make it compete with the title it annotates.
        style={isSmall ? { fontSize: 10 } : undefined}
      >
        {label}
      </Text>
    </View>
  );
}
