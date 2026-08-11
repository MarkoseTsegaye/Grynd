import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import { NumberPad, applyKey } from './NumberPad';
import { formatWeight } from '../../../shared/lib/weight';

type Field = 'weight' | 'reps';

interface Props {
  computedWeightKg: number;
  weightUnit: 'kg' | 'lbs';
  plates: Record<number, number>;
  plateList: number[];
  onAddPlate: (weight: number) => void;
  onRemovePlate: (weight: number) => void;
  onClearPlates: () => void;
  onToggleUnit: () => void;
  repValue: string;
  onChangeReps: (value: string) => void;
  toFailure: boolean;
  onToggleFailure: () => void;
  isLogging: boolean;
  onLog: () => void;
  /** Opens the full LogSheet for RPE, notes, unilateral side. */
  onMore: () => void;
}

/**
 * Docked plate-loaded entry for the fast path. Same skeleton as QuickLogBar:
 * two fields, quick flags, a pad, and Log set — but the pad is plate buttons
 * when weight is active and the number keypad when reps is active. Weight is
 * the per-side sum (no bar, no doubling).
 */
export function PlateLogBar({
  computedWeightKg,
  weightUnit,
  plates,
  plateList,
  onAddPlate,
  onRemovePlate,
  onClearPlates,
  onToggleUnit,
  repValue,
  onChangeReps,
  toFailure,
  onToggleFailure,
  isLogging,
  onLog,
  onMore,
}: Props) {
  const [active, setActive] = useState<Field>('weight');

  const handleRepsKey = useCallback(
    (key: string) => onChangeReps(applyKey(repValue, key, { decimal: false, maxLen: 3 })),
    [repValue, onChangeReps],
  );

  const perSide = Object.entries(plates)
    .map(([w, c]) => ({ weight: Number(w), count: c }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.weight - a.weight);
  const plateCount = perSide.reduce((n, p) => n + p.count, 0);
  const hasPlates = perSide.length > 0;
  const canLog = !isLogging && hasPlates && parseInt(repValue, 10) > 0;

  return (
    <View className="pt-2">
      {/* Fields */}
      <View className="flex-row gap-2 mb-2">
        <TouchableOpacity
          className={`flex-1 rounded-lg px-4 py-2.5 ${active === 'weight' ? 'bg-surface-2 border-2 border-accent' : 'bg-surface-1 border-2 border-transparent'}`}
          onPress={() => setActive('weight')}
          accessibilityRole="button"
          accessibilityLabel={`Weight per side ${formatWeight(computedWeightKg, weightUnit)} ${weightUnit}, tap to load plates`}
          activeOpacity={0.7}
        >
          <Text className={`text-text-secondary ${textRoles.caption}`}>WEIGHT · PER SIDE</Text>
          <View className="flex-row items-baseline gap-1">
            <Text className={`${active === 'weight' ? 'text-accent' : 'text-text-primary'} ${textRoles.metricDisplayCompact}`}>
              {formatWeight(computedWeightKg, weightUnit)}
            </Text>
            <Text className={`text-text-secondary ${textRoles.inputSuffix}`}>{weightUnit}</Text>
          </View>
          <Text className={`text-text-disabled ${textRoles.caption}`}>
            {hasPlates ? `${plateCount} ${plateCount === 1 ? 'plate' : 'plates'} · no bar` : 'tap plates below'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 rounded-lg px-4 py-2.5 ${active === 'reps' ? 'bg-surface-2 border-2 border-accent' : 'bg-surface-1 border-2 border-transparent'}`}
          onPress={() => setActive('reps')}
          accessibilityRole="button"
          accessibilityLabel={`Reps ${repValue || 'empty'}, tap to edit`}
          activeOpacity={0.7}
        >
          <Text className={`text-text-secondary ${textRoles.caption}`}>REPS</Text>
          <Text className={`${active === 'reps' ? 'text-accent' : 'text-text-primary'} ${textRoles.metricDisplayCompact}`}>
            {repValue || '0'}
          </Text>
          <Text className={`text-text-disabled ${textRoles.caption}`}>&nbsp;</Text>
        </TouchableOpacity>
      </View>

      {active === 'weight' ? (
        <>
          {/* Per-side summary — tap a chip to remove one */}
          {hasPlates && (
            <View className="flex-row flex-wrap items-center gap-2 mb-2">
              <Text className={`text-text-disabled ${textRoles.caption} uppercase`}>Loaded</Text>
              {perSide.map((p) => (
                <TouchableOpacity
                  key={p.weight}
                  className="flex-row items-center gap-1 bg-surface-2 rounded-lg px-2.5 py-1"
                  onPress={() => onRemovePlate(p.weight)}
                  accessibilityLabel={`Remove one ${p.weight} plate`}
                  accessibilityRole="button"
                  activeOpacity={0.6}
                >
                  <Text className={`text-accent ${textRoles.metricBold}`}>{p.weight}</Text>
                  <Text className={`text-text-secondary ${textRoles.metric}`}>×{p.count}</Text>
                  <Icon name="close-circle" size={13} color="text-secondary" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                className="ml-auto"
                onPress={onClearPlates}
                accessibilityLabel="Clear all plates"
                accessibilityRole="button"
                activeOpacity={0.6}
              >
                <Text className={`text-text-secondary ${textRoles.caption}`}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Plate pad */}
          <View className="flex-row flex-wrap gap-2 mb-2">
            {plateList.map((weight) => {
              const count = plates[weight] ?? 0;
              return (
                <TouchableOpacity
                  key={weight}
                  className={`bg-surface-1 rounded-lg items-center justify-center ${count > 0 ? 'border-2 border-accent' : 'border-2 border-transparent'}`}
                  style={{ width: '31.5%', height: 54, flexGrow: 1 }}
                  onPress={() => onAddPlate(weight)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${weight} ${weightUnit} plate per side`}
                  activeOpacity={0.6}
                >
                  {count > 0 && (
                    <Text className={`absolute top-1 right-2 text-accent ${textRoles.metricBold}`}>{count}</Text>
                  )}
                  <Text className={`text-text-primary ${textRoles.metricLarge}`}>{weight}</Text>
                  <Text className={`text-text-disabled ${textRoles.caption}`}>+ per side</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : (
        <View className="mb-2">
          <NumberPad onKey={handleRepsKey} />
        </View>
      )}

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
          className="flex-1 h-11 rounded-lg items-center justify-center bg-surface-1"
          onPress={onToggleUnit}
          accessibilityRole="button"
          accessibilityLabel={`Weight unit ${weightUnit}, tap to switch`}
          activeOpacity={0.7}
        >
          <Text className={textRoles.toggleLabel}>
            <Text className="text-accent">{weightUnit}</Text>
            <Text className="text-text-disabled"> · {weightUnit === 'lbs' ? 'kg' : 'lbs'}</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 h-11 rounded-lg flex-row items-center justify-center gap-1.5 bg-surface-1"
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel="More set options: RPE, notes"
          activeOpacity={0.7}
        >
          <Icon name="tune-variant" size={16} color="text-secondary" />
          <Text className={`${textRoles.toggleLabel} text-text-secondary`}>RPE · Note</Text>
        </TouchableOpacity>
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
