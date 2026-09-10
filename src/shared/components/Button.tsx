import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Icon, type IconName } from './Icon';
import { colors } from '../theme/colors';
import { textRoles } from '../theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  /** Leading glyph. Tinted to match the variant's label. */
  icon?: IconName;
  /** Swaps the label for a spinner and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const SIZES = {
  md: { frame: 'px-6 py-4', label: textRoles.buttonLabel, icon: 20 },
  sm: { frame: 'px-3 h-9', label: textRoles.buttonLabelSmall, icon: 16 },
} as const;

const VARIANTS = {
  primary: { frame: 'bg-accent', text: 'text-surface-0', tint: 'surface-0' },
  ghost: { frame: 'bg-surface-2', text: 'text-text-primary', tint: 'text-primary' },
  danger: { frame: 'bg-danger', text: 'text-text-primary', tint: 'text-primary' },
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  accessibilityLabel,
}: Props) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isBlocked = disabled || loading;

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center gap-2 rounded-lg ${s.frame} ${v.frame} ${
        isBlocked ? 'opacity-40' : ''
      }`}
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isBlocked, busy: !!loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={colors[v.tint]} />
      ) : (
        <>
          {icon && <Icon name={icon} size={s.icon} color={v.tint} />}
          <Text className={`${v.text} ${s.label}`}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
