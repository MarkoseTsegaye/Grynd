import React from 'react';
import { View, Text } from 'react-native';
import { textRoles } from '../../../shared/theme/typography';
import { colors } from '../../../shared/theme/colors';
import type { WeightPoint } from '../lib/weightStats';

interface Props {
  points: WeightPoint[];
}

const STRIP_HEIGHT = 60;
const BAR_MIN_HEIGHT = 4;

/**
 * A compact horizontal bar strip showing daily calorie intake alongside the
 * weight chart. Each column corresponds one-to-one with a `WeightPoint`;
 * days without calories render as an empty outline so the user sees the gap.
 * No axis / no numeric labels — this is intended as a visual companion to
 * the weight line for bulk/cut context, not a chart on its own.
 */
export function CaloriesOverlay({ points }: Props) {
  const values = points.map((p) => p.calories ?? 0);
  const max = Math.max(...values, 1);
  const anyCalories = values.some((v) => v > 0);

  return (
    <View className="bg-surface-1 rounded-xl px-3 py-3 mt-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className={`text-text-secondary ${textRoles.caption} uppercase tracking-widest`}>
          Calories
        </Text>
        {!anyCalories && (
          <Text className={`text-text-disabled ${textRoles.caption}`}>None logged</Text>
        )}
      </View>
      <View
        className="flex-row items-end justify-between gap-1"
        style={{ height: STRIP_HEIGHT }}
      >
        {points.map((point) => {
          const cal = point.calories ?? null;
          const heightPx =
            cal === null
              ? BAR_MIN_HEIGHT
              : Math.max(BAR_MIN_HEIGHT, (cal / max) * (STRIP_HEIGHT - BAR_MIN_HEIGHT));
          return (
            <View
              key={point.id}
              style={{
                flex: 1,
                height: heightPx,
                borderRadius: 2,
                backgroundColor: cal === null ? 'transparent' : colors['accent-dim'],
                borderWidth: cal === null ? 1 : 0,
                borderColor: colors['surface-2'],
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
