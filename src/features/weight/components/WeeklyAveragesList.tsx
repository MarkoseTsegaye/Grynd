import React from 'react';
import { Text, View } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import {
  formatBodyWeightDelta,
  formatBodyWeightValue,
  unitLabel,
  type WeightUnit,
} from '../lib/weightUnits';
import type { WeeklyAverage } from '../lib/weightStats';

interface Props {
  averages: WeeklyAverage[];
  unit: WeightUnit;
}

const STEADY_THRESHOLD_LBS = 0.2;

export function WeeklyAveragesList({ averages, unit }: Props) {
  if (averages.length === 0) return null;
  const suffix = unitLabel(unit);

  return (
    <View className="bg-surface-1 rounded-xl px-4 py-4 mb-4">
      <Text
        className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}
        accessibilityRole="header"
      >
        Weekly averages
      </Text>
      {averages.map((week, index) => {
        const direction =
          week.deltaLbs === null
            ? 'first'
            : Math.abs(week.deltaLbs) < STEADY_THRESHOLD_LBS
              ? 'steady'
              : week.deltaLbs > 0
                ? 'up'
                : 'down';
        return (
          <View
            key={week.weekEndMs}
            className={`flex-row items-center justify-between py-2 ${
              index !== averages.length - 1 ? 'border-b border-surface-2' : ''
            }`}
          >
            <View className="flex-1 pr-3">
              <Text className={`text-text-primary ${textRoles.body}`}>Week of {week.label}</Text>
              <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
                {week.entryCount} {week.entryCount === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            <View className="items-end">
              <Text className={`text-text-primary ${textRoles.metricLarge}`}>
                {formatBodyWeightValue(week.avgLbs, unit)}
                <Text className={`text-text-secondary ${textRoles.bodySmall}`}> {suffix}</Text>
              </Text>
              {direction !== 'first' ? (
                <View className="flex-row items-center gap-0.5 mt-0.5">
                  {/* Neutral, same reasoning as WeightSummary. */}
                  <Icon
                    name={
                      direction === 'up'
                        ? 'arrow-up'
                        : direction === 'down'
                          ? 'arrow-down'
                          : 'minus'
                    }
                    size={12}
                    color="text-secondary"
                  />
                  <Text className={`text-text-secondary ${textRoles.caption}`}>
                    {direction === 'steady'
                      ? '0'
                      : formatBodyWeightDelta(week.deltaLbs ?? 0, unit)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
