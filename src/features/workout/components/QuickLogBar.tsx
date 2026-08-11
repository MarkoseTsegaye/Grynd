import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';

type Field = 'weight' | 'reps';

interface Props {
  weightValue: string;
  repValue: string;
  weightUnit: 'kg' | 'lbs';
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  toFailure: boolean;
  onToggleFailure: () => void;
  isLogging: boolean;
  onLog: () => void;
  /** Opens the full LogSheet for plates, RPE, notes, unilateral side. */
  onMore: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/** Append/erase a keypad digit against a string field. */
function applyKey(current: string, key: string, opts: { decimal: boolean; maxLen: number }): string {
  if (key === 'del') return current.slice(0, -1);
  if (key === '.') {
    if (!opts.decimal || current.includes('.')) return current;
    return current === '' ? '0.' : current + '.';
  }
  if (current.length >= opts.maxLen) return current;
  if (current === '0') return key; // replace a lone leading zero
  return current + key;
}

/**
 * Docked numeric keypad for the fast straight-weight log path.
 * Weight × reps + a one-tap failure flag; everything else (plates, RPE,
 * notes, unilateral side) lives behind "More" in the existing LogSheet.
 */
export function QuickLogBar({
  weightValue,
  repValue,
  weightUnit,
  onChangeWeight,
  onChangeReps,
  toFailure,
  onToggleFailure,
  isLogging,
  onLog,
  onMore,
}: Props) {
  const [active, setActive] = useState<Field>('weight');

  const handleKey = useCallback(
    (key: string) => {
      if (active === 'weight') {
        onChangeWeight(applyKey(weightValue, key, { decimal: true, maxLen: 6 }));
      } else {
        onChangeReps(applyKey(repValue, key, { decimal: false, maxLen: 3 }));
      }
    },
    [active, weightValue, repValue, onChangeWeight, onChangeReps],
  );

  const canLog = !isLogging && parseFloat(weightValue) > 0 && parseInt(repValue, 10) > 0;

  return (
    <View className="pt-2">
      {/* Field displays */}
      <View className="flex-row gap-2 mb-2">
        <FieldDisplay
          label="WEIGHT"
          value={weightValue}
          suffix={weightUnit}
          isActive={active === 'weight'}
          onPress={() => setActive('weight')}
        />
        <FieldDisplay
          label="REPS"
          value={repValue}
          isActive={active === 'reps'}
          onPress={() => setActive('reps')}
        />
      </View>

      {/* Quick flags */}
      <View className="flex-row gap-2 mb-2">
        <TouchableOpacity
          className={`flex-1 h-11 rounded-lg flex-row items-center justify-center gap-1.5 ${toFailure ? 'bg-danger/10 border border-danger/50' : 'bg-surface-1'}`}
          onPress={onToggleFailure}
          accessibilityRole="button"
          accessibilityState={{ selected: toFailure }}
          accessibilityLabel={toFailure ? 'Remove to-failure flag' : 'Mark set to failure'}
          activeOpacity={0.7}
        >
          <Icon name="fire" size={18} color={toFailure ? 'danger' : 'text-secondary'} />
          <Text className={`${textRoles.toggleLabel} ${toFailure ? 'text-danger' : 'text-text-secondary'}`}>
            To failure
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 h-11 rounded-lg flex-row items-center justify-center gap-1.5 bg-surface-1"
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel="More set options: plates, RPE, notes"
          activeOpacity={0.7}
        >
          <Icon name="tune-variant" size={16} color="text-secondary" />
          <Text className={`${textRoles.toggleLabel} text-text-secondary`}>Plates · RPE · Note</Text>
        </TouchableOpacity>
      </View>

      {/* Keypad */}
      <View className="flex-row flex-wrap gap-2 mb-2">
        {KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            className="bg-surface-1 rounded-lg items-center justify-center"
            style={{ width: '31.5%', height: 48, flexGrow: 1 }}
            onPress={() => handleKey(key)}
            accessibilityRole="button"
            accessibilityLabel={key === 'del' ? 'Delete' : key === '.' ? 'Decimal point' : key}
            activeOpacity={0.6}
          >
            {key === 'del' ? (
              <Icon name="backspace-outline" size={20} color="text-secondary" />
            ) : (
              <Text className={`text-text-primary ${textRoles.metricLarge}`}>{key}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Primary */}
      <TouchableOpacity
        className={`bg-accent rounded-lg h-14 flex-row items-center justify-center gap-2 ${!canLog ? 'opacity-40' : ''}`}
        onPress={onLog}
        disabled={!canLog}
        accessibilityRole="button"
        accessibilityLabel="Log set"
        activeOpacity={0.8}
      >
        <Icon name="plus-circle-outline" size={22} color="surface-0" />
        <Text className={`text-surface-0 ${textRoles.actionLabel}`}>Log set</Text>
      </TouchableOpacity>
    </View>
  );
}

function FieldDisplay({
  label,
  value,
  suffix,
  isActive,
  onPress,
}: {
  label: string;
  value: string;
  suffix?: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={`flex-1 rounded-lg px-4 py-2.5 ${isActive ? 'bg-surface-2 border-2 border-accent' : 'bg-surface-1 border-2 border-transparent'}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value || 'empty'}${suffix ? ' ' + suffix : ''}, tap to edit`}
      activeOpacity={0.7}
    >
      <Text className={`text-text-secondary ${textRoles.caption}`}>{label}</Text>
      <View className="flex-row items-baseline gap-1">
        <Text className={`${isActive ? 'text-accent' : 'text-text-primary'} ${textRoles.metricDisplayCompact}`}>
          {value || '0'}
        </Text>
        {suffix ? <Text className={`text-text-secondary ${textRoles.inputSuffix}`}>{suffix}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}
