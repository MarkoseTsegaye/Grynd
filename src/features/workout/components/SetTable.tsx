import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import { formatSetWeightParts } from '../../../shared/lib/weight';
import { compareSets } from '../../history/lib/compareSetPerformance';
import { SetProgressIndicator } from '../../history/components/SetProgressIndicator';
import { getEffortLabels } from '../lib/effort';
import type { LoggedSet } from '../types';

interface Props {
  sets: LoggedSet[];
  /** Same exercise last session — drives deltas and the ghost target rows. */
  previousSets: LoggedSet[];
  weightUnit: 'kg' | 'lbs';
  editingSetIndex: number | null;
  onEditSet: (index: number) => void;
  onDeleteSet: (index: number) => void;
}

const COL_NUM = 18;
const COL_REPS = 54;
const COL_DELTA = 40;

/**
 * The logged sets as an aligned table rather than wrapping pills, so weights
 * and reps line up in a column you can scan at a glance.
 *
 * Rows past what you've logged are filled with last session's sets as dim
 * "ghosts" — the target you're chasing, in the position you'll log it. That
 * replaces the cramped one-line "Last Aug 11 · 60×6 · 55×7" header.
 */
export function SetTable({
  sets,
  previousSets,
  weightUnit,
  editingSetIndex,
  onEditSet,
  onDeleteSet,
}: Props) {
  const ghostSets = previousSets.slice(sets.length);
  const isEmpty = sets.length === 0 && ghostSets.length === 0;

  return (
    <View className="flex-1">
      {/* Column headers */}
      <View className="flex-row items-center gap-2 px-1 pb-1.5">
        <Text className={`text-text-disabled ${textRoles.caption}`} style={{ width: COL_NUM, fontSize: 10 }}>
          #
        </Text>
        <Text className={`flex-1 text-text-disabled ${textRoles.sectionLabel}`} style={{ fontSize: 10 }}>
          Weight
        </Text>
        <Text
          className={`text-text-disabled ${textRoles.sectionLabel} text-right`}
          style={{ width: COL_REPS, fontSize: 10 }}
        >
          Reps
        </Text>
        <View style={{ width: COL_DELTA }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {isEmpty && (
          <Text className={`text-text-disabled ${textRoles.bodySmall} text-center px-6 py-8`}>
            No sets yet — enter a weight and reps below to log your first.
          </Text>
        )}

        {sets.map((set, i) => (
          <LoggedRow
            key={`${set.loggedAt}-${i}`}
            index={i}
            set={set}
            priorSet={previousSets[i]}
            weightUnit={weightUnit}
            isEditing={editingSetIndex === i}
            onEdit={() => onEditSet(i)}
            onDelete={() => onDeleteSet(i)}
          />
        ))}

        {ghostSets.map((set, i) => (
          <GhostRow
            key={`ghost-${set.loggedAt}-${i}`}
            setNumber={sets.length + i + 1}
            set={set}
            weightUnit={weightUnit}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function LoggedRow({
  index,
  set,
  priorSet,
  weightUnit,
  isEditing,
  onEdit,
  onDelete,
}: {
  index: number;
  set: LoggedSet;
  priorSet?: LoggedSet;
  weightUnit: 'kg' | 'lbs';
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const setNumber = index + 1;
  const { weightText, unitLabel, plateBreakdown } = formatSetWeightParts(set, weightUnit);
  const comparison = priorSet ? compareSets(priorSet, set) : null;
  const { toFailure, rirLabel } = getEffortLabels(set.effort);
  const sideLabel = set.side === 'left' ? 'L' : set.side === 'right' ? 'R' : null;
  const hasMeta = !!plateBreakdown || toFailure || !!rirLabel || !!set.notes;

  return (
    <View
      className={`rounded-lg mb-0.5 ${isEditing ? 'bg-accent/[0.07] border border-accent/30' : 'border border-transparent'}`}
    >
      <View className="flex-row items-center gap-2 px-1 py-2">
        <TouchableOpacity
          className="flex-row items-center gap-2 flex-1"
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Set ${setNumber}, ${weightText} ${unitLabel} by ${set.reps} reps — tap to edit`}
          activeOpacity={0.6}
        >
          <Text
            className={`text-text-disabled ${textRoles.metricBold}`}
            style={{ width: COL_NUM, fontSize: 12 }}
          >
            {setNumber}
          </Text>
          <View className="flex-1 flex-row items-baseline gap-1">
            {sideLabel && (
              <Text className={`text-accent ${textRoles.metricBold}`}>{sideLabel}</Text>
            )}
            <Text className={`text-text-primary ${textRoles.metricBody}`}>{weightText}</Text>
            <Text className={`text-text-disabled ${textRoles.caption}`} style={{ fontSize: 11 }}>
              {unitLabel}
            </Text>
          </View>
          <View className="flex-row items-baseline justify-end gap-1" style={{ width: COL_REPS }}>
            <Text className={`text-text-primary ${textRoles.metricBody}`}>{set.reps}</Text>
            <Text className={`text-text-disabled ${textRoles.caption}`} style={{ fontSize: 11 }}>
              ×
            </Text>
          </View>
          <View className="items-end" style={{ width: COL_DELTA }}>
            {comparison && priorSet && (
              <SetProgressIndicator
                setNumber={setNumber}
                prev={priorSet}
                current={set}
                result={comparison}
              />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete set ${setNumber}`}
          hitSlop={8}
          activeOpacity={0.6}
        >
          <Icon name="close-circle" size={15} color="text-disabled" />
        </TouchableOpacity>
      </View>

      {hasMeta && (
        <View
          className="flex-row items-center flex-wrap gap-1.5 pb-2"
          style={{ paddingLeft: COL_NUM + 12 }}
        >
          {plateBreakdown && (
            <View className="rounded bg-surface-2 px-1.5 py-0.5">
              <Text className={`text-text-secondary ${textRoles.metric}`} style={{ fontSize: 11 }}>
                {plateBreakdown}
              </Text>
            </View>
          )}
          {toFailure && (
            <View className="rounded border border-danger/50 px-1.5 py-0.5">
              <Text className={`text-danger ${textRoles.caption}`} style={{ fontSize: 10 }}>
                FAILURE
              </Text>
            </View>
          )}
          {rirLabel && (
            <View className="rounded bg-surface-2 px-1.5 py-0.5">
              <Text className={`text-text-secondary ${textRoles.caption}`} style={{ fontSize: 10 }}>
                {rirLabel}
              </Text>
            </View>
          )}
          {!!set.notes && (
            <Text
              className={`flex-1 text-text-secondary ${textRoles.caption} italic`}
              style={{ fontSize: 11 }}
              numberOfLines={1}
            >
              {set.notes}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function GhostRow({
  setNumber,
  set,
  weightUnit,
}: {
  setNumber: number;
  set: LoggedSet;
  weightUnit: 'kg' | 'lbs';
}) {
  const { weightText, unitLabel } = formatSetWeightParts(set, weightUnit);

  return (
    <View
      className="flex-row items-center gap-2 px-1 py-2"
      accessibilityLabel={`Set ${setNumber} target from last session, ${weightText} ${unitLabel} by ${set.reps} reps`}
    >
      <Text
        className={`text-text-disabled/50 ${textRoles.metricBold}`}
        style={{ width: COL_NUM, fontSize: 12 }}
      >
        {setNumber}
      </Text>
      <View className="flex-1 flex-row items-baseline gap-1">
        <Text className={`text-text-disabled ${textRoles.metricBody}`}>{weightText}</Text>
        <Text className={`text-text-disabled/60 ${textRoles.caption}`} style={{ fontSize: 11 }}>
          {unitLabel}
        </Text>
      </View>
      <View className="flex-row items-baseline justify-end gap-1" style={{ width: COL_REPS }}>
        <Text className={`text-text-disabled ${textRoles.metricBody}`}>{set.reps}</Text>
        <Text className={`text-text-disabled/60 ${textRoles.caption}`} style={{ fontSize: 11 }}>
          ×
        </Text>
      </View>
      <View className="items-end" style={{ width: COL_DELTA }}>
        <Text className={`text-text-disabled/70 ${textRoles.caption}`} style={{ fontSize: 9 }}>
          LAST
        </Text>
      </View>
    </View>
  );
}
