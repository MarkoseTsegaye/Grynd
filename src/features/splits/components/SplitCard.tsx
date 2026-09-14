import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { Badge } from '../../../shared/components/Badge';
import { colors } from '../../../shared/theme/colors';
import { getSplitGlyph } from '../lib/splitGlyph';
import { textRoles } from '../../../shared/theme/typography';
import type { Split } from '../types';

interface Props {
  split: Split;
  exerciseCount: number;
  /** Home tab: whole card starts the workout. */
  onPress?: () => void;
  /** Splits tab: whole card opens Manage. */
  onManage?: () => void;
  /** Home tab: this split is the current cycle day. */
  isToday?: boolean;
  /** Home tab: "Yesterday" / "3 days ago" / null when never performed. */
  lastPerformedLabel?: string | null;
  /** Splits tab: "days 1, 4", or null when the cycle never runs this split. */
  cycleLabel?: string | null;
  /** Splits tab: flag a split the cycle will never surface. */
  showNotInCycle?: boolean;
  /** Splits tab: starts a reorder drag. Rendered inside the card so the row
   *  reads as one object rather than a handle floating in the gutter. */
  onDrag?: () => void;
}

export function SplitCard({
  split,
  exerciseCount,
  onPress,
  onManage,
  isToday,
  lastPerformedLabel,
  cycleLabel,
  showNotInCycle,
  onDrag,
}: Props) {
  const isStartMode = !!onPress && !onManage;

  // Cycle placement used to be two badges beside the title, which
  // crowded out the name and painted "NOT IN CYCLE" in warning amber —
  // a normal state for anyone with more splits than cycle days. It is
  // metadata, so it reads as metadata, on the caption line.
  const captionParts = [`${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`];
  if (lastPerformedLabel) captionParts.push(lastPerformedLabel);
  // `formatCycleDays` returns "day 5" / "days 1, 4" — sentence-cased here
  // because it reads as its own clause after the separator.
  if (cycleLabel) captionParts.push(cycleLabel.charAt(0).toUpperCase() + cycleLabel.slice(1));
  else if (showNotInCycle) captionParts.push('Not in cycle');

  const inner = (
    // Today's split gets an accent edge and tag so the hero card and this list
    // stay in sync — otherwise every row looks equally like "the" workout.
    <View
      className="bg-surface-1 rounded-lg px-4 py-4 mb-3"
      // Inline width on purpose: with `border-l-2 border-accent` NativeWind
      // applies the colour but resolves borderLeftWidth to 0, so the accent
      // edge rendered invisibly. Verified in the web build.
      style={isToday ? { borderLeftWidth: 3, borderLeftColor: colors.accent } : undefined}
    >
      <View className="flex-row items-center justify-between">
        {onDrag && (
          <TouchableOpacity
            onLongPress={onDrag}
            delayLongPress={150}
            className="pr-2 py-2 -ml-1"
            accessibilityLabel={`Drag to reorder ${split.name}`}
            activeOpacity={0.6}
          >
            <Icon name="drag-vertical" size={20} color="text-secondary" />
          </TouchableOpacity>
        )}
        <View
          className="bg-surface-2 rounded-lg items-center justify-center mr-3"
          style={{ width: 38, height: 38 }}
        >
          <Icon name={getSplitGlyph(split.name)} size={20} color={isToday ? 'accent' : 'text-secondary'} />
        </View>
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-2">
            <Text
              className={`text-text-primary ${textRoles.cardTitle} shrink`}
              numberOfLines={1}
            >
              {split.name}
            </Text>
            {isToday && <Badge label="TODAY" variant="accent" size="sm" />}
          </View>
          <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
            {captionParts.join(' · ')}
          </Text>
        </View>
        {/* Manage mode deletes by swipe now, so the trailing slot says where
            the row goes instead of offering a second destructive target. */}
        <Icon
          name={isStartMode ? 'play-circle-outline' : 'chevron-right'}
          size={20}
          color={isStartMode ? 'accent' : 'text-secondary'}
        />
      </View>
    </View>
  );

  const activate = onPress ?? onManage;
  if (!activate) return inner;

  return (
    <TouchableOpacity
      onPress={activate}
      accessibilityLabel={
        onPress
          ? `Start ${split.name} workout${isToday ? ", today's split" : ''}${
              lastPerformedLabel ? `, last performed ${lastPerformedLabel}` : ', never performed'
            }`
          : `Manage ${split.name}, ${captionParts.join(', ')}`
      }
      activeOpacity={0.7}
    >
      {inner}
    </TouchableOpacity>
  );
}
