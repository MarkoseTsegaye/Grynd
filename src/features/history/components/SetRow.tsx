import React from 'react';
import { View, Text } from 'react-native';
import { formatSetWeightParts } from '../../../shared/lib/weight';
import { textRoles } from '../../../shared/theme/typography';
import { compareSets } from '../lib/compareSetPerformance';
import { SetProgressIndicator } from './SetProgressIndicator';
import type { LoggedSet } from '../../workout/types';

interface Props {
  setNumber: number;
  set: LoggedSet;
  /** Same-position set from the previous session, for the delta chip. */
  priorSet?: LoggedSet | null;
  weightUnit: 'kg' | 'lbs';
}

/**
 * One logged set, shared by the History card and the session detail so both
 * read identically. Two tiers keep the numbers scannable down a column:
 *
 *   1   70 lb × 8 reps              [▲3] [TO FAILURE]
 *       45+25 · RPE 9 · free-text note
 *
 * The total weight is always the headline; the plate breakdown drops to the
 * detail line so a plate set no longer renders as "45 × 1, 25 × 1 × 8 reps".
 * Anything that can grow unpredictably (plates, RPE, notes) lives on tier two,
 * so the primary line never wraps and every set lines up with its neighbours.
 */
export function SetRow({ setNumber, set, priorSet, weightUnit }: Props) {
  const { weightText, unitLabel, plateBreakdown } = formatSetWeightParts(set, weightUnit);
  const comparison = priorSet ? compareSets(priorSet, set) : null;

  const toFailure = !!set.effort?.toFailure;
  const rpe = set.effort?.rpe;
  const sideLabel = set.side === 'left' ? 'L' : set.side === 'right' ? 'R' : null;
  const hasDetail = !!plateBreakdown || rpe !== undefined || !!set.notes;

  return (
    <View className="py-1">
      <View className="flex-row items-center gap-1.5">
        <Text className={`text-text-disabled ${textRoles.caption}`} style={{ width: 14 }}>
          {setNumber}
        </Text>

        {sideLabel && <Text className={`text-accent ${textRoles.metricBold}`}>{sideLabel}</Text>}

        <Text className={`text-text-primary ${textRoles.metricBold}`}>{weightText}</Text>
        <Text className={`text-text-disabled ${textRoles.metric}`}>{unitLabel}</Text>
        <Text className={`text-text-disabled ${textRoles.metric}`}>×</Text>
        <Text className={`text-text-primary ${textRoles.metricBold}`}>{set.reps}</Text>
        <Text className={`text-text-disabled ${textRoles.metric}`}>reps</Text>

        <View className="flex-1" />

        {comparison && priorSet && (
          <SetProgressIndicator
            setNumber={setNumber}
            prev={priorSet}
            current={set}
            result={comparison}
          />
        )}

        {toFailure && (
          <View className="rounded-md border border-danger/50 px-1.5 py-0.5">
            <Text className={`text-danger ${textRoles.caption}`} style={{ fontSize: 11 }}>
              FAILURE
            </Text>
          </View>
        )}
      </View>

      {hasDetail && (
        <View className="flex-row items-center flex-wrap gap-1.5 mt-0.5" style={{ paddingLeft: 22 }}>
          {plateBreakdown && (
            <Text className={`text-text-secondary ${textRoles.metric}`} style={{ fontSize: 12 }}>
              {plateBreakdown}
            </Text>
          )}
          {plateBreakdown && rpe !== undefined && (
            <Text className={`text-text-disabled ${textRoles.caption}`}>·</Text>
          )}
          {rpe !== undefined && (
            <Text className={`text-text-secondary ${textRoles.caption}`} style={{ fontSize: 12 }}>
              RPE {rpe}
            </Text>
          )}
          {!!set.notes && (
            <View className="flex-row items-center gap-1.5 flex-1">
              {(plateBreakdown || rpe !== undefined) && (
                <View className="rounded-full bg-text-disabled" style={{ width: 3, height: 3 }} />
              )}
              <Text
                className={`flex-1 text-text-secondary ${textRoles.caption} italic`}
                numberOfLines={2}
              >
                {set.notes}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
