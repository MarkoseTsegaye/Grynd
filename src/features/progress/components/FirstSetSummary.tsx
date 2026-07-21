import React from 'react';
import { View, Text } from 'react-native';
import { textRoles } from '../../../shared/theme/typography';
import { formatWeight } from '../../../shared/lib/weight';
import type { FirstSetPoint, FirstSetTrend } from '../lib/firstSetProgress';

interface Props {
  point: FirstSetPoint;
  trend: FirstSetTrend | null;
  isPersonalBest: boolean;
  weightUnit: 'kg' | 'lbs';
  showTrendHint?: boolean;
}

function getTrendColor(kind: FirstSetTrend['kind']): string {
  if (kind === 'weight_up' || kind === 'reps_up') return 'text-success';
  if (kind === 'weight_down' || kind === 'reps_down') return 'text-danger';
  return 'text-text-secondary';
}

function getTrendLabel(trend: FirstSetTrend, weightUnit: 'kg' | 'lbs'): string {
  switch (trend.kind) {
    case 'weight_up': {
      const delta = formatWeight(Math.abs(trend.deltaWeightKg), weightUnit);
      return `Up ${delta} ${weightUnit} vs last session`;
    }
    case 'weight_down': {
      const delta = formatWeight(Math.abs(trend.deltaWeightKg), weightUnit);
      return `Down ${delta} ${weightUnit} vs last session`;
    }
    case 'reps_up':
      return `Same weight · +${trend.deltaReps} reps`;
    case 'reps_down':
      return `Same weight · ${trend.deltaReps} reps`;
    case 'neutral':
      return 'Unchanged vs last session';
  }
}

export function FirstSetSummary({
  point,
  trend,
  isPersonalBest,
  weightUnit,
  showTrendHint = true,
}: Props) {
  const weightText = formatWeight(point.weightKg, weightUnit);

  return (
    <View className="mb-6">
      <Text className={`text-text-secondary ${textRoles.sectionLabelCompact} mb-1`}>
        FIRST SET · {point.label.toUpperCase()}
      </Text>
      <Text className={`text-text-primary ${textRoles.metricLarge}`}>
        {point.reps} × {weightText}
        <Text className={`text-text-secondary ${textRoles.body}`}> {weightUnit}</Text>
      </Text>
      {isPersonalBest ? (
        <Text className={`text-accent ${textRoles.bodySmall} mt-2`}>Personal best</Text>
      ) : null}
      {trend ? (
        <Text className={`${getTrendColor(trend.kind)} ${textRoles.bodySmall} mt-1`}>
          {getTrendLabel(trend, weightUnit)}
        </Text>
      ) : showTrendHint ? (
        <Text className={`text-text-secondary ${textRoles.bodySmall} mt-1`}>
          Complete one more session to see your trend.
        </Text>
      ) : null}
    </View>
  );
}
