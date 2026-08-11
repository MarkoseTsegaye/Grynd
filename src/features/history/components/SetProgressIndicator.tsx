import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import type { LoggedSet } from '../../workout/types';
import {
  buildSetComparisonAccessibilityLabel,
  formatSetDeltaLabel,
  type SetComparisonResult,
} from '../lib/compareSetPerformance';

interface Props {
  setNumber: number;
  prev: LoggedSet;
  current: LoggedSet;
  result: NonNullable<SetComparisonResult>;
}

/**
 * Compact "vs. last time" delta chip. Replaces the old repeated `^ ^` chevrons,
 * which had no legend and read as noise in a dense set list — one arrow plus a
 * magnitude is scannable at a glance and matches the History legend.
 */
export function SetProgressIndicator({ setNumber, prev, current, result }: Props) {
  const isProgress = result.direction === 'progress';

  return (
    <View
      className={`flex-row items-center rounded-md pl-0.5 pr-1.5 py-0.5 ${isProgress ? 'bg-success/15' : 'bg-danger/15'}`}
      accessibilityLabel={buildSetComparisonAccessibilityLabel(setNumber, prev, current, result)}
    >
      <Icon
        name={isProgress ? 'menu-up' : 'menu-down'}
        size={14}
        color={isProgress ? 'success' : 'danger'}
      />
      <Text
        className={`${textRoles.metricBold} ${isProgress ? 'text-success' : 'text-danger'}`}
        style={{ fontSize: 12 }}
      >
        {formatSetDeltaLabel(result)}
      </Text>
    </View>
  );
}
