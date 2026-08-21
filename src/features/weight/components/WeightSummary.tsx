import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import type { WeeklyDelta } from '../lib/weightStats';

interface Props {
  currentLbs: number | null;
  rolling7dayAvgLbs: number | null;
  weeklyDelta: WeeklyDelta | null;
}

function formatLbs(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function formatDelta(value: number): string {
  const abs = Math.abs(value);
  const rounded = Math.round(abs * 10) / 10;
  const numeric = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  return `${numeric} lb`;
}

export function WeightSummary({ currentLbs, rolling7dayAvgLbs, weeklyDelta }: Props) {
  return (
    <View className="bg-surface-1 rounded-xl px-4 py-4 mb-4">
      <View className="flex-row items-end gap-2">
        <Text className={`text-text-primary ${textRoles.metricDisplay}`}>
          {currentLbs !== null ? formatLbs(currentLbs) : '—'}
        </Text>
        <Text className={`text-text-secondary ${textRoles.bodySmall} mb-2`}>lb</Text>
      </View>
      <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>Latest weight</Text>

      <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-surface-2">
        <View className="flex-1 pr-3">
          <Text className={`text-text-secondary ${textRoles.caption} mb-1`}>7-day avg</Text>
          <Text className={`text-text-primary ${textRoles.metricLarge}`}>
            {rolling7dayAvgLbs !== null ? `${formatLbs(rolling7dayAvgLbs)}` : '—'}
            <Text className={`text-text-secondary ${textRoles.bodySmall}`}> lb</Text>
          </Text>
        </View>

        <View className="flex-1 pl-3 border-l border-surface-2">
          <Text className={`text-text-secondary ${textRoles.caption} mb-1`}>vs prior 7 days</Text>
          {weeklyDelta ? (
            <View className="flex-row items-center gap-1">
              <Icon
                name={
                  weeklyDelta.direction === 'up'
                    ? 'arrow-up'
                    : weeklyDelta.direction === 'down'
                      ? 'arrow-down'
                      : 'minus'
                }
                size={18}
                color={
                  weeklyDelta.direction === 'steady'
                    ? 'text-secondary'
                    : weeklyDelta.direction === 'up'
                      ? 'warning'
                      : 'success'
                }
              />
              <Text className={`text-text-primary ${textRoles.metricLarge}`}>
                {weeklyDelta.direction === 'steady' ? '0' : formatDelta(weeklyDelta.deltaLbs)}
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
