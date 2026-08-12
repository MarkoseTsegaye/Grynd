import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { textRoles } from '../../../shared/theme/typography';

interface Props {
  unilateral: boolean;
  plateLoaded: boolean;
  onChangeUnilateral: (value: boolean) => void;
  onChangePlateLoaded: (value: boolean) => void;
  /** Hides the explanatory hint where space is tight. */
  compact?: boolean;
}

interface OptionProps {
  title: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

function Option({ title, hint, selected, onPress, accessibilityLabel }: OptionProps) {
  return (
    <TouchableOpacity
      className={`flex-1 rounded-lg px-2 py-2 items-center ${selected ? 'bg-surface-2' : ''}`}
      style={selected ? { borderWidth: 1, borderColor: 'rgba(232, 255, 71, 0.5)' } : undefined}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.7}
    >
      <Text
        className={`${textRoles.toggleLabel} ${selected ? 'text-accent' : 'text-text-secondary'}`}
        style={{ fontSize: 13 }}
      >
        {title}
      </Text>
      <Text
        className={`${selected ? 'text-text-secondary' : 'text-text-disabled'} ${textRoles.caption}`}
        style={{ fontSize: 10 }}
        numberOfLines={1}
      >
        {hint}
      </Text>
    </TouchableOpacity>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-2">
      <Text
        className={`text-text-disabled ${textRoles.sectionLabel} mb-1.5`}
        style={{ fontSize: 10 }}
      >
        {label}
      </Text>
      <View className="flex-row gap-1.5 bg-surface-0 rounded-xl p-1">{children}</View>
    </View>
  );
}

/**
 * Exercise attributes as two labelled choices.
 *
 * Replaces a pair of toggle rows that each offered a button labelled
 * "Regular" — identical text, distinguishable only by the button beside it —
 * and painted both defaults in full accent, so an untouched default competed
 * with the screen's actual primary action. Here the group label says what is
 * being decided, each option names itself, and only a selection is tinted.
 */
export function ExerciseAttributeControls({
  unilateral,
  plateLoaded,
  onChangeUnilateral,
  onChangePlateLoaded,
  compact = false,
}: Props) {
  return (
    <View>
      <Group label="How it's performed">
        <Option
          title="Both sides"
          hint="one weight"
          selected={!unilateral}
          onPress={() => onChangeUnilateral(false)}
          accessibilityLabel="Performed with both sides at once, logged as one weight"
        />
        <Option
          title="Left / right"
          hint="log each side"
          selected={unilateral}
          onPress={() => onChangeUnilateral(true)}
          accessibilityLabel="Performed one side at a time, logged per side"
        />
      </Group>

      <Group label="How weight is set">
        <Option
          title="Straight"
          hint="type the weight"
          selected={!plateLoaded}
          onPress={() => onChangePlateLoaded(false)}
          accessibilityLabel="Weight typed in directly"
        />
        <Option
          title="Plate-loaded"
          hint="tap plates per side"
          selected={plateLoaded}
          onPress={() => onChangePlateLoaded(true)}
          accessibilityLabel="Plate loaded machine, weight entered by tapping plates per side"
        />
      </Group>

      {!compact && plateLoaded && (
        <Text className={`text-text-disabled ${textRoles.caption} mt-0.5`} style={{ fontSize: 11 }}>
          Logging opens the plate pad and records the per-side load — no bar weight added.
        </Text>
      )}
    </View>
  );
}
