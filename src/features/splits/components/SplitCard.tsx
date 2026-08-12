import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { colors } from '../../../shared/theme/colors';
import { getSplitGlyph } from '../lib/splitGlyph';
import { textRoles } from '../../../shared/theme/typography';
import type { Split } from '../types';

interface Props {
  split: Split;
  exerciseCount: number;
  /** Home tab: whole card starts workout */
  onPress?: () => void;
  /** Splits tab: edit icon */
  onManage?: () => void;
  /** Splits tab: delete icon */
  onDelete?: () => void;
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
  onDelete,
  isToday,
  lastPerformedLabel,
  cycleLabel,
  showNotInCycle,
  onDrag,
}: Props) {
  const isStartMode = !!onPress && !onManage;

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
            <Icon name="drag-vertical" size={18} color="text-disabled" />
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
            {isToday && (
              <View className="bg-accent rounded px-1.5 py-0.5">
                <Text className={`text-surface-0 ${textRoles.captionBold}`} style={{ fontSize: 10 }}>
                  TODAY
                </Text>
              </View>
            )}
            {!isToday && cycleLabel && (
              <View className="bg-surface-2 rounded px-1.5 py-0.5">
                <Text
                  className={`text-text-secondary ${textRoles.captionBold}`}
                  style={{ fontSize: 10 }}
                >
                  {cycleLabel.toUpperCase()}
                </Text>
              </View>
            )}
            {showNotInCycle && (
              <View
                className="rounded px-1.5 py-0.5"
                style={{ borderWidth: 1, borderColor: 'rgba(255, 176, 32, 0.45)' }}
              >
                <Text className={`text-warning ${textRoles.captionBold}`} style={{ fontSize: 10 }}>
                  NOT IN CYCLE
                </Text>
              </View>
            )}
          </View>
          <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
            {lastPerformedLabel ? ` · ${lastPerformedLabel}` : ''}
          </Text>
        </View>
        {isStartMode ? (
          <Icon name="play-circle-outline" size={20} color="accent" />
        ) : (
          <View className="flex-row gap-3 items-center">
            {onManage && (
              <TouchableOpacity
                onPress={onManage}
                accessibilityLabel={`Edit ${split.name}`}
                activeOpacity={0.7}
              >
                <Icon name="pencil-outline" size={20} color="text-secondary" />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={onDelete}
                accessibilityLabel={`Delete ${split.name}`}
                activeOpacity={0.7}
              >
                <Icon name="trash-can-outline" size={20} color="text-secondary" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityLabel={`Start ${split.name} workout${isToday ? ", today's split" : ''}${
          lastPerformedLabel ? `, last performed ${lastPerformedLabel}` : ', never performed'
        }`}
        activeOpacity={0.7}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}
