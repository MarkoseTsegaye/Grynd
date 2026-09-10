import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { textRoles } from '../theme/typography';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * The one selectable-pill control. Before this the app had three
 * different treatments for "pick one of N" — range chips, a segmented
 * control, and disabled-able range pills — which read as three
 * different kinds of control for the same job.
 *
 * 40 px tall rather than 44: these sit in dense horizontal rows where
 * a 44 px pill crowds the content it filters, and they are always
 * adjacent to same-purpose siblings, so a mis-tap picks a neighbouring
 * filter rather than doing something destructive.
 */
export function Chip({ label, selected, onPress, disabled, accessibilityLabel }: Props) {
  return (
    <TouchableOpacity
      className={`rounded-lg px-4 h-10 items-center justify-center ${
        selected ? 'bg-accent' : 'bg-surface-1'
      } ${disabled ? 'opacity-40' : ''}`}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      activeOpacity={0.7}
    >
      <Text
        className={`${textRoles.toggleLabel} ${
          selected ? 'text-surface-0' : 'text-text-secondary'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
