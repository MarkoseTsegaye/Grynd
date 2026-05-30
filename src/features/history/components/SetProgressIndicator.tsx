import React from 'react';
import { View } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import type { LoggedSet } from '../../workout/types';
import {
  buildSetComparisonAccessibilityLabel,
  type SetComparisonResult,
} from '../lib/compareSetPerformance';

interface Props {
  setNumber: number;
  prev: LoggedSet;
  current: LoggedSet;
  result: NonNullable<SetComparisonResult>;
}

export function SetProgressIndicator({ setNumber, prev, current, result }: Props) {
  const isProgress = result.direction === 'progress';
  const iconName = isProgress ? 'chevron-up' : 'chevron-down';
  const color = isProgress ? 'success' : 'danger';

  return (
    <View
      className="flex-row items-center gap-0"
      accessibilityLabel={buildSetComparisonAccessibilityLabel(setNumber, prev, current, result)}
    >
      {Array.from({ length: result.arrowCount }, (_, i) => (
        <Icon key={i} name={iconName} size={13} color={color} />
      ))}
    </View>
  );
}
