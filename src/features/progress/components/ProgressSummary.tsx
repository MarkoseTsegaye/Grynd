import React from 'react';
import { View, Text } from 'react-native';
import { textRoles } from '../../../shared/theme/typography';
import { formatVolumeAbbreviated, type VolumePoint, type VolumeTrend } from '../lib/sessionVolume';

interface Props {
  trend: VolumeTrend | null;
  latestPoint: VolumePoint | null;
}

function getTrendColor(direction: VolumeTrend['direction']): string {
  if (direction === 'progress') return 'text-success';
  if (direction === 'decline') return 'text-danger';
  return 'text-text-secondary';
}

function getTrendLabel(trend: VolumeTrend): string {
  if (trend.direction === 'neutral') return 'Unchanged vs last session';

  const prefix = trend.direction === 'progress' ? 'Up' : 'Down';
  if (trend.deltaPercent === null) return `${prefix} vs last session`;
  return `${prefix} ${trend.deltaPercent}% vs last session`;
}

export function ProgressSummary({ trend, latestPoint }: Props) {
  if (!latestPoint) return null;

  return (
    <View className="mb-6">
      <Text className={`text-text-secondary ${textRoles.sectionLabelCompact} mb-1`}>
        LATEST VOLUME
      </Text>
      <Text className={`text-text-primary ${textRoles.metricLarge} mb-2`}>
        {formatVolumeAbbreviated(latestPoint.volume)} kg·reps
      </Text>
      {trend ? (
        <Text className={`${getTrendColor(trend.direction)} ${textRoles.bodySmall}`}>
          {getTrendLabel(trend)}
        </Text>
      ) : (
        <Text className={`text-text-secondary ${textRoles.bodySmall}`}>
          Complete one more workout to see your trend.
        </Text>
      )}
    </View>
  );
}
