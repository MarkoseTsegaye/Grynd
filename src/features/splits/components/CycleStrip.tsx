import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { textRoles } from '../../../shared/theme/typography';
import type { CycleStripDay } from '../lib/cycleStrip';

interface Props {
  days: CycleStripDay[];
  totalDays: number;
  onPress?: () => void;
}

/**
 * The cycle as a row of pills, so where you are in it is visible at a glance
 * rather than only stated as "Day 5 of 8" in text.
 */
export function CycleStrip({ days, totalDays, onPress }: Props) {
  if (days.length === 0) return null;

  const today = days.find((day) => day.state === 'today');

  const strip = (
    <View className="flex-row gap-1.5">
      {days.map((day) => {
        const isToday = day.state === 'today';
        const isDone = day.state === 'done';

        return (
          <View
            key={day.key}
            className={`flex-1 rounded-lg items-center justify-center px-0.5 ${
              isToday ? 'bg-accent' : 'bg-surface-1'
            }`}
            style={{ height: 44 }}
          >
            <Text
              className={`${textRoles.captionBold} ${
                isToday ? 'text-surface-0' : isDone ? 'text-text-disabled' : 'text-text-primary'
              }`}
              style={{ fontSize: 12 }}
            >
              {day.dayNumber}
            </Text>
            <Text
              className={`${textRoles.caption} ${
                isToday
                  ? 'text-surface-0'
                  : day.isRest || isDone
                    ? 'text-text-disabled'
                    : 'text-text-secondary'
              }`}
              style={{ fontSize: 9.5 }}
              numberOfLines={1}
            >
              {day.label}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const label = today
    ? `Training cycle, day ${today.dayNumber} of ${totalDays}, ${today.label}. Edit cycle.`
    : 'Training cycle. Edit cycle.';

  if (!onPress) {
    return <View accessibilityLabel={label}>{strip}</View>;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
    >
      {strip}
    </TouchableOpacity>
  );
}
