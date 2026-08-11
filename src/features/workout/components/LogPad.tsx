import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import { NumberPad, applyKey } from './NumberPad';
import { formatWeight } from '../../../shared/lib/weight';
import { RIR_OPTIONS, describeRir, formatRir, formatRirOption } from '../lib/effort';

type Field = 'weight' | 'reps';
type Panel = 'none' | 'rir' | 'note';

const MAX_NOTE_LENGTH = 200;
const NOTE_SHORTCUTS = ['straps', 'assisted', 'paused', 'tempo'];

interface Props {
  mode: 'straight' | 'plates';
  collapsed: boolean;
  onToggleCollapsed: () => void;

  weightValue: string;
  repValue: string;
  weightUnit: 'kg' | 'lbs';
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;

  computedWeightKg: number;
  plates: Record<number, number>;
  plateList: number[];
  onAddPlate: (weight: number) => void;
  onRemovePlate: (weight: number) => void;
  onClearPlates: () => void;
  onToggleUnit: () => void;

  toFailure: boolean;
  onToggleFailure: () => void;
  rir: number | undefined;
  onChangeRir: (rir: number | undefined) => void;
  notes: string;
  onChangeNotes: (notes: string) => void;

  isUnilateral: boolean;
  setSide: 'left' | 'right';
  onChangeSide: (side: 'left' | 'right') => void;

  isEditing: boolean;
  isLogging: boolean;
  onLog: () => void;
  onCancelEdit: () => void;
}

/**
 * The docked entry pad for both straight-weight and plate-loaded exercises.
 *
 * Collapses to a single bar via the grab handle so the set list can own the
 * screen, and keeps effort metadata (failure / RIR / note) inline instead of
 * behind a modal — the modal route used to reset the form and throw away
 * whatever weight and reps had already been entered.
 */
export function LogPad({
  mode,
  collapsed,
  onToggleCollapsed,
  weightValue,
  repValue,
  weightUnit,
  onChangeWeight,
  onChangeReps,
  computedWeightKg,
  plates,
  plateList,
  onAddPlate,
  onRemovePlate,
  onClearPlates,
  onToggleUnit,
  toFailure,
  onToggleFailure,
  rir,
  onChangeRir,
  notes,
  onChangeNotes,
  isUnilateral,
  setSide,
  onChangeSide,
  isEditing,
  isLogging,
  onLog,
  onCancelEdit,
}: Props) {
  // Both modes start on weight so the pad below matches the field: the number
  // keypad for straight weight, the plate buttons for plate-loaded.
  const [active, setActive] = useState<Field>('weight');
  const [panel, setPanel] = useState<Panel>('none');

  useEffect(() => {
    setActive('weight');
    setPanel('none');
  }, [mode]);

  const handleKey = useCallback(
    (key: string) => {
      if (mode === 'straight' && active === 'weight') {
        onChangeWeight(applyKey(weightValue, key, { decimal: true, maxLen: 6 }));
      } else {
        onChangeReps(applyKey(repValue, key, { decimal: false, maxLen: 3 }));
      }
    },
    [mode, active, weightValue, repValue, onChangeWeight, onChangeReps],
  );

  const perSide = Object.entries(plates)
    .map(([w, c]) => ({ weight: Number(w), count: c }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.weight - a.weight);
  const plateCount = perSide.reduce((n, p) => n + p.count, 0);
  const hasPlates = perSide.length > 0;

  const weightReady = mode === 'plates' ? hasPlates : parseFloat(weightValue) > 0;
  const canLog = !isLogging && weightReady && parseInt(repValue, 10) > 0;

  const weightText = mode === 'plates' ? formatWeight(computedWeightKg, weightUnit) : weightValue || '0';

  const togglePanel = useCallback((next: Panel) => {
    setPanel((current) => (current === next ? 'none' : next));
  }, []);

  /** Reaching for a field means you want the keypad back, not the open panel. */
  const focusField = useCallback((field: Field) => {
    setActive(field);
    setPanel('none');
  }, []);

  /* ---------------- collapsed ---------------- */
  if (collapsed) {
    return (
      <View className="bg-surface-1 rounded-2xl px-3 pb-3 pt-1">
        <GrabHandle label="log" collapsed onPress={onToggleCollapsed} />
        <TouchableOpacity
          className="flex-row items-center gap-3"
          onPress={onToggleCollapsed}
          accessibilityRole="button"
          accessibilityLabel="Expand log pad"
          activeOpacity={0.7}
        >
          <View className="flex-1 flex-row items-baseline gap-1">
            <Text className={`text-text-primary ${textRoles.metricBody}`}>{weightText}</Text>
            <Text className={`text-text-disabled ${textRoles.caption}`}>{weightUnit}</Text>
            <Text className={`text-text-disabled ${textRoles.caption}`}> × </Text>
            <Text className={`${repValue ? 'text-text-primary' : 'text-text-disabled'} ${textRoles.metricBody}`}>
              {repValue || '—'}
            </Text>
            <Text className={`text-text-disabled ${textRoles.caption}`}>reps</Text>
          </View>
          <View className="bg-accent rounded-lg flex-row items-center gap-1.5 px-4" style={{ height: 40 }}>
            <Icon name="plus-circle-outline" size={17} color="surface-0" />
            <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>Log</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  /* ---------------- expanded ---------------- */
  return (
    <View className="bg-surface-1 rounded-2xl px-3 pb-3 pt-1">
      <GrabHandle
        label={isEditing ? 'cancel' : 'hide'}
        collapsed={false}
        onPress={isEditing ? onCancelEdit : onToggleCollapsed}
      />

      {isUnilateral && (
        <View className="flex-row gap-2 mb-2">
          {(['left', 'right'] as const).map((side) => (
            <TouchableOpacity
              key={side}
              className={`flex-1 h-9 rounded-lg items-center justify-center ${setSide === side ? 'bg-accent' : 'bg-surface-2'}`}
              onPress={() => onChangeSide(side)}
              accessibilityRole="button"
              accessibilityState={{ selected: setSide === side }}
              accessibilityLabel={`${side} side`}
              activeOpacity={0.7}
            >
              <Text
                className={`${textRoles.toggleLabel} ${setSide === side ? 'text-surface-0' : 'text-text-secondary'}`}
              >
                {side === 'left' ? 'Left' : 'Right'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Fields */}
      <View className="flex-row gap-2 mb-2">
        <TouchableOpacity
          className={`flex-1 rounded-xl px-3 py-2 border-2 ${active === 'weight' ? 'bg-surface-0 border-accent' : 'bg-surface-0 border-transparent'}`}
          onPress={() => focusField('weight')}
          accessibilityRole="button"
          accessibilityLabel={`Weight ${weightText} ${weightUnit}, tap to edit`}
          activeOpacity={0.7}
        >
          <Text className={`text-text-disabled ${textRoles.caption}`} style={{ fontSize: 10 }}>
            {mode === 'plates' ? 'WEIGHT · PER SIDE' : 'WEIGHT'}
          </Text>
          <View className="flex-row items-baseline gap-1">
            <Text
              className={`${active === 'weight' ? 'text-accent' : 'text-text-primary'} ${textRoles.metricDisplayCompact}`}
            >
              {weightText}
            </Text>
            <Text className={`text-text-disabled ${textRoles.inputSuffix}`}>{weightUnit}</Text>
          </View>
          {mode === 'plates' && (
            <Text className={`text-text-disabled ${textRoles.caption}`} style={{ fontSize: 10 }}>
              {hasPlates ? `${plateCount} ${plateCount === 1 ? 'plate' : 'plates'} · no bar` : 'tap plates below'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 rounded-xl px-3 py-2 border-2 ${active === 'reps' ? 'bg-surface-0 border-accent' : 'bg-surface-0 border-transparent'}`}
          onPress={() => focusField('reps')}
          accessibilityRole="button"
          accessibilityLabel={`Reps ${repValue || 'empty'}, tap to edit`}
          activeOpacity={0.7}
        >
          <Text className={`text-text-disabled ${textRoles.caption}`} style={{ fontSize: 10 }}>
            REPS
          </Text>
          <Text
            className={`${active === 'reps' ? 'text-accent' : 'text-text-primary'} ${textRoles.metricDisplayCompact}`}
          >
            {repValue || '0'}
          </Text>
          {mode === 'plates' && <Text className={textRoles.caption} style={{ fontSize: 10 }}> </Text>}
        </TouchableOpacity>
      </View>

      {/* Effort chips — inline, no modal */}
      <View className="flex-row gap-1.5 mb-2">
        <MetaChip
          icon="fire"
          label="Failure"
          active={toFailure}
          danger
          onPress={onToggleFailure}
          accessibilityLabel={toFailure ? 'Remove to-failure flag' : 'Mark set to failure'}
        />
        <MetaChip
          icon="gauge"
          label="RIR"
          value={rir !== undefined ? formatRirOption(rir) : undefined}
          active={rir !== undefined}
          open={panel === 'rir'}
          onPress={() => togglePanel('rir')}
          accessibilityLabel={
            rir !== undefined ? `Reps in reserve ${formatRir(rir)}, tap to change` : 'Set reps in reserve'
          }
        />
        <MetaChip
          icon="note-text-outline"
          label="Note"
          active={notes.trim().length > 0}
          open={panel === 'note'}
          onPress={() => togglePanel('note')}
          accessibilityLabel={notes.trim() ? 'Edit set note' : 'Add a note to this set'}
        />
      </View>

      {/* Panel slot replaces the pad while open */}
      {panel === 'rir' ? (
        <View className="bg-surface-0 rounded-xl p-2.5 mb-2">
          <View className="flex-row items-center justify-between mb-2">
            <Text className={`text-text-disabled ${textRoles.sectionLabel}`} style={{ fontSize: 10 }}>
              Reps in reserve
            </Text>
            <TouchableOpacity
              onPress={() => onChangeRir(undefined)}
              accessibilityRole="button"
              accessibilityLabel="Clear reps in reserve"
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Text className={`text-text-secondary ${textRoles.caption}`}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-1.5">
            {RIR_OPTIONS.map((option) => {
              const selected = rir === option;
              return (
                <TouchableOpacity
                  key={option}
                  className={`flex-1 rounded-lg items-center justify-center ${selected ? 'bg-accent' : 'bg-surface-2'}`}
                  style={{ height: 40 }}
                  onPress={() => onChangeRir(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={formatRir(option)}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`${textRoles.metricBody} ${selected ? 'text-surface-0' : 'text-text-secondary'}`}
                  >
                    {formatRirOption(option)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text className={`text-text-disabled ${textRoles.caption} text-center mt-2`} style={{ fontSize: 11 }}>
            {rir !== undefined ? describeRir(rir) : 'how many reps were left?'}
          </Text>
        </View>
      ) : panel === 'note' ? (
        <View className="bg-surface-0 rounded-xl p-2.5 mb-2">
          <View className="flex-row items-center justify-between mb-2">
            <Text className={`text-text-disabled ${textRoles.sectionLabel}`} style={{ fontSize: 10 }}>
              Note for this set
            </Text>
            <TouchableOpacity
              onPress={() => setPanel('none')}
              accessibilityRole="button"
              accessibilityLabel="Close note editor"
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Text className={`text-accent ${textRoles.caption}`}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            className="bg-surface-2 rounded-lg px-3 py-2 text-text-primary font-sans text-sm"
            style={{ minHeight: 56 }}
            value={notes}
            onChangeText={onChangeNotes}
            placeholder="e.g. used straps, paused mid-set"
            placeholderTextColor="#3D3B38"
            multiline
            textAlignVertical="top"
            maxLength={MAX_NOTE_LENGTH}
            accessibilityLabel="Set note"
          />
          <View className="flex-row flex-wrap gap-1.5 mt-2">
            {NOTE_SHORTCUTS.map((phrase) => (
              <TouchableOpacity
                key={phrase}
                className="bg-surface-2 rounded-md px-2.5 py-1.5"
                onPress={() =>
                  onChangeNotes(
                    (notes.trim() ? `${notes.trim()}, ` : '').concat(phrase).slice(0, MAX_NOTE_LENGTH),
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Add "${phrase}" to the note`}
                activeOpacity={0.7}
              >
                <Text className={`text-text-secondary ${textRoles.caption}`} style={{ fontSize: 11 }}>
                  + {phrase}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : mode === 'plates' && active === 'weight' ? (
        <PlatePad
          plates={plates}
          plateList={plateList}
          perSide={perSide}
          weightUnit={weightUnit}
          onAddPlate={onAddPlate}
          onRemovePlate={onRemovePlate}
          onClearPlates={onClearPlates}
          onToggleUnit={onToggleUnit}
        />
      ) : (
        <View className="mb-2">
          <NumberPad onKey={handleKey} />
        </View>
      )}

      {/* Primary */}
      <TouchableOpacity
        className={`bg-accent rounded-xl flex-row items-center justify-center gap-2 ${!canLog ? 'opacity-40' : ''}`}
        style={{ height: 50 }}
        onPress={onLog}
        disabled={!canLog}
        accessibilityRole="button"
        accessibilityLabel={isEditing ? 'Save set' : 'Log set'}
        activeOpacity={0.8}
      >
        <Icon name={isEditing ? 'check' : 'plus-circle-outline'} size={20} color="surface-0" />
        <Text className={`text-surface-0 ${textRoles.actionLabel}`}>
          {isEditing ? 'Save set' : 'Log set'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function GrabHandle({
  label,
  collapsed,
  onPress,
}: {
  label: string;
  collapsed: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="items-center justify-center"
      style={{ height: 26 }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={collapsed ? 'Expand log pad' : 'Hide log pad'}
      activeOpacity={0.6}
    >
      <View className="bg-surface-2 rounded-full" style={{ width: 38, height: 4 }} />
      <View className="absolute right-0 top-1 flex-row items-center gap-1">
        <Text className={`text-text-disabled ${textRoles.caption}`} style={{ fontSize: 11 }}>
          {label}
        </Text>
        <Icon name={collapsed ? 'chevron-up' : 'chevron-down'} size={16} color="text-disabled" />
      </View>
    </TouchableOpacity>
  );
}

function MetaChip({
  icon,
  label,
  value,
  active,
  open,
  danger,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value?: string;
  active: boolean;
  open?: boolean;
  danger?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const tone = danger && active
    ? 'bg-danger/10 border-danger/50'
    : active || open
      ? 'bg-surface-2 border-accent/40'
      : 'bg-surface-0 border-transparent';
  const textTone = danger && active ? 'text-danger' : active ? 'text-text-primary' : 'text-text-secondary';

  return (
    <TouchableOpacity
      className={`flex-1 rounded-lg flex-row items-center justify-center gap-1 border ${tone}`}
      style={{ height: 36 }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active, expanded: open }}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.7}
    >
      <Icon name={icon} size={14} color={danger && active ? 'danger' : active ? 'accent' : 'text-secondary'} />
      <Text className={`${textRoles.toggleLabel} ${textTone}`} style={{ fontSize: 12.5 }}>
        {label}
      </Text>
      {value !== undefined && (
        <Text className={`text-accent ${textRoles.metricBold}`} style={{ fontSize: 12.5 }}>
          {value}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function PlatePad({
  plates,
  plateList,
  perSide,
  weightUnit,
  onAddPlate,
  onRemovePlate,
  onClearPlates,
  onToggleUnit,
}: {
  plates: Record<number, number>;
  plateList: number[];
  perSide: { weight: number; count: number }[];
  weightUnit: 'kg' | 'lbs';
  onAddPlate: (weight: number) => void;
  onRemovePlate: (weight: number) => void;
  onClearPlates: () => void;
  onToggleUnit: () => void;
}) {
  return (
    <>
      {perSide.length > 0 && (
        <View className="flex-row flex-wrap items-center gap-1.5 mb-2">
          {perSide.map((p) => (
            <TouchableOpacity
              key={p.weight}
              className="flex-row items-center gap-1 bg-surface-2 rounded-md px-2 py-1"
              onPress={() => onRemovePlate(p.weight)}
              accessibilityRole="button"
              accessibilityLabel={`Remove one ${p.weight} plate`}
              activeOpacity={0.6}
            >
              <Text className={`text-accent ${textRoles.metricBold}`} style={{ fontSize: 12 }}>
                {p.weight}
              </Text>
              <Text className={`text-text-secondary ${textRoles.metric}`} style={{ fontSize: 12 }}>
                ×{p.count}
              </Text>
              <Icon name="close-circle" size={12} color="text-secondary" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            className="ml-auto"
            onPress={onClearPlates}
            accessibilityRole="button"
            accessibilityLabel="Clear all plates"
            hitSlop={8}
            activeOpacity={0.6}
          >
            <Text className={`text-text-secondary ${textRoles.caption}`}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      <View className="flex-row flex-wrap gap-1.5 mb-2">
        {plateList.map((weight) => {
          const count = plates[weight] ?? 0;
          return (
            <TouchableOpacity
              key={weight}
              className={`bg-surface-0 rounded-lg items-center justify-center border-2 ${count > 0 ? 'border-accent' : 'border-transparent'}`}
              style={{ width: '31.5%', height: 48, flexGrow: 1 }}
              onPress={() => onAddPlate(weight)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${weight} ${weightUnit} plate per side`}
              activeOpacity={0.6}
            >
              {count > 0 && (
                <Text className={`absolute top-0.5 right-2 text-accent ${textRoles.metricBold}`} style={{ fontSize: 11 }}>
                  {count}
                </Text>
              )}
              <Text className={`text-text-primary ${textRoles.metricBody}`}>{weight}</Text>
              <Text className={`text-text-disabled ${textRoles.caption}`} style={{ fontSize: 9 }}>
                + per side
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        className="bg-surface-0 rounded-lg items-center justify-center mb-2"
        style={{ height: 32 }}
        onPress={onToggleUnit}
        accessibilityRole="button"
        accessibilityLabel={`Weight unit ${weightUnit}, tap to switch`}
        activeOpacity={0.7}
      >
        <Text className={textRoles.toggleLabel} style={{ fontSize: 12.5 }}>
          <Text className="text-accent">{weightUnit}</Text>
          <Text className="text-text-disabled"> · {weightUnit === 'lbs' ? 'kg' : 'lbs'}</Text>
        </Text>
      </TouchableOpacity>
    </>
  );
}
