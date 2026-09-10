import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import {
  formatBodyWeightDelta,
  formatBodyWeightValue,
  unitLabel,
  type WeightUnit,
} from '../lib/weightUnits';
import type { WeeklyDelta } from '../lib/weightStats';

interface Props {
  currentLbs: number | null;
  rolling7dayAvgLbs: number | null;
  weeklyDelta: WeeklyDelta | null;
  unit: WeightUnit;
  /** Shown under the headline number, e.g. "Today · Sep 10". */
  latestLabel?: string;
}

export function WeightSummary({
  currentLbs,
  rolling7dayAvgLbs,
  weeklyDelta,
  unit,
  latestLabel,
}: Props) {
  const suffix = unitLabel(unit);

  return (
    <View className="bg-surface-1 rounded-xl px-4 py-4 mb-4">
      <View className="flex-row items-end gap-2">
        <Text className={`text-text-primary ${textRoles.metricDisplay}`}>
          {currentLbs !== null ? formatBodyWeightValue(currentLbs, unit) : '—'}
        </Text>
        <Text className={`text-text-secondary ${textRoles.bodySmall} mb-2`}>{suffix}</Text>
      </View>
      <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
        {latestLabel ?? 'Latest weight'}
      </Text>

      <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-surface-2">
        <View className="flex-1 pr-3">
          <Text className={`text-text-secondary ${textRoles.caption} mb-1`}>7-day avg</Text>
          <Text className={`text-text-primary ${textRoles.metricLarge}`}>
            {rolling7dayAvgLbs !== null ? formatBodyWeightValue(rolling7dayAvgLbs, unit) : '—'}
            <Text className={`text-text-secondary ${textRoles.bodySmall}`}> {suffix}</Text>
          </Text>
        </View>

        <View className="flex-1 pl-3 border-l border-surface-2">
          <Text className={`text-text-secondary ${textRoles.caption} mb-1`}>vs prior 7 days</Text>
          {weeklyDelta ? (
            <View className="flex-row items-center gap-1">
              {/* Neutral on purpose: whether up is good depends on whether
                  the user is bulking or cutting, which the app doesn't
                  know. Colouring it green/amber picked a side. */}
              <Icon
                name={
                  weeklyDelta.direction === 'up'
                    ? 'arrow-up'
                    : weeklyDelta.direction === 'down'
                      ? 'arrow-down'
                      : 'minus'
                }
                size={18}
                color="text-secondary"
              />
              <Text className={`text-text-primary ${textRoles.metricLarge}`}>
                {weeklyDelta.direction === 'steady'
                  ? '0'
                  : formatBodyWeightDelta(weeklyDelta.deltaLbs, unit)}
              </Text>
            </View>
          ) : (
            <Text className={`text-text-disabled ${textRoles.bodySmall}`}>
              Log a couple more weigh-ins
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
