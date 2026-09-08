import React from 'react';
import { Text, View } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import type { WeeklyAverage } from '../lib/weightStats';

interface Props {
  averages: WeeklyAverage[];
}

function formatLbs(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function formatDelta(value: number): string {
  const abs = Math.abs(value);
  const rounded = Math.round(abs * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

const STEADY_THRESHOLD_LBS = 0.2;

export function WeeklyAveragesList({ averages }: Props) {
  if (averages.length === 0) return null;

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
                {formatLbs(week.avgLbs)}
                <Text className={`text-text-secondary ${textRoles.bodySmall}`}> lb</Text>
              </Text>
              {direction !== 'first' ? (
                <View className="flex-row items-center gap-0.5 mt-0.5">
                  <Icon
                    name={
                      direction === 'up'
                        ? 'arrow-up'
                        : direction === 'down'
                          ? 'arrow-down'
                          : 'minus'
                    }
                    size={12}
                    color={
                      direction === 'steady'
                        ? 'text-secondary'
                        : direction === 'up'
                          ? 'warning'
                          : 'success'
                    }
                  />
                  <Text
                    className={`${textRoles.caption} ${
                      direction === 'steady'
                        ? 'text-text-secondary'
                        : direction === 'up'
                          ? 'text-warning'
                          : 'text-success'
                    }`}
                  >
                    {direction === 'steady'
                      ? '0'
                      : `${formatDelta(week.deltaLbs ?? 0)} lb`}
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
