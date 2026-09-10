import React from 'react';
import { View, Text } from 'react-native';
import { textRoles } from '../../../shared/theme/typography';
import type { ExerciseLineDelta } from '../lib/exerciseLine';

/** Fixed width so the metric column stays aligned down a card. */
const CHIP_MIN_WIDTH = 52;

const TONES = {
  up: { frame: 'bg-success/15', text: 'text-success' },
  down: { frame: 'bg-danger/15', text: 'text-danger' },
  flat: { frame: 'bg-surface-2', text: 'text-text-secondary' },
} as const;

/**
 * The session-to-session change on a history row: `+5 lb`, `−1 rep`, `same`.
 * Deliberately not the shared `Badge` — that is a solid-fill Inter status tag,
 * this is a translucent fixed-width numeric chip.
 */
export function ExerciseDeltaChip({ delta }: { delta: ExerciseLineDelta | null }) {
  // No prior session to compare against: hold the column, say nothing.
  if (delta === null) return <View style={{ minWidth: CHIP_MIN_WIDTH }} />;

  const tone = TONES[delta.direction];
  return (
    <View
      className={`${tone.frame} items-center rounded-md px-1.5 py-0.5`}
      style={{ minWidth: CHIP_MIN_WIDTH }}
    >
      <Text className={`${tone.text} ${textRoles.metricBold}`} style={{ fontSize: 12 }}>
        {delta.label}
      </Text>
    </View>
  );
}
