import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { formatShortDate } from '../../workout/../../shared/lib/date';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { formatSetWeightDisplay } from '../../../shared/lib/weight';
import { textRoles } from '../../../shared/theme/typography';
import { useHistoryStore } from '../store/historyStore';
import { compareSets } from '../lib/compareSetPerformance';
import { getPriorExerciseSets } from '../lib/getPriorExerciseSets';
import { SetProgressIndicator } from './SetProgressIndicator';
import type { WorkoutSession } from '../../workout/types';

interface Props {
  session: WorkoutSession;
  onPress: () => void;
}

export function SessionCard({ session, onPress }: Props) {
  const { weightUnit, isLoaded: prefsLoaded, loadPrefs } = usePrefsStore();
  const { sessions } = useHistoryStore();

  useEffect(() => {
    if (!prefsLoaded) loadPrefs();
  }, [prefsLoaded, loadPrefs]);
  const totalSets = session.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const visibleExercises = session.exercises.slice(0, 4);
  const extraCount = session.exercises.length - 4;

  return (
    <TouchableOpacity
      className="bg-surface-1 rounded-lg px-4 py-3 mb-4"
      onPress={onPress}
      accessibilityLabel={`${session.splitName} session`}
      activeOpacity={0.7}
    >
      {/* Level 1: header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className={`text-text-secondary ${textRoles.caption}`}>
          {formatShortDate(session.completedAt ?? session.startedAt)}
        </Text>
        <Text className={`text-text-primary ${textRoles.cardTitleSmall}`} numberOfLines={1}>
          {session.splitName}
        </Text>
      </View>

      {/* Level 2 + 3: exercises */}
      {visibleExercises.map((ex, exIdx) => {
        const priorSets = getPriorExerciseSets(session, ex.exerciseId, sessions);
        return (
        <View
          key={ex.exerciseId}
          className={`border-t border-surface-2 pt-2 ${exIdx < visibleExercises.length - 1 || extraCount > 0 ? 'mb-3' : 'mb-0'}`}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className={`text-text-primary ${textRoles.listItemTitle}`}>{ex.exerciseName}</Text>
            <Text className={`text-text-secondary ${textRoles.caption}`}>{ex.sets.length} sets</Text>
          </View>
          {ex.sets.map((set, i) => {
            const { weightText, unitLabel } = formatSetWeightDisplay(set, weightUnit);
            const hasFail = set.effort?.toFailure;
            const hasRpe = set.effort?.rpe !== undefined;
            const hasNotes = !!set.notes;
            const priorSet = priorSets && i < priorSets.length ? priorSets[i] : null;
            const comparison = priorSet ? compareSets(priorSet, set) : null;
            return (
              <View key={`${set.loggedAt}-${i}`} className="flex-row items-center gap-1 pl-4 mb-1 flex-wrap">
                <Text className={`text-text-disabled ${textRoles.caption}`}>Set {i + 1}</Text>
                <Text className={`text-text-primary ${textRoles.metric}`}> {weightText}</Text>
                {unitLabel ? (
                  <Text className={`text-text-secondary ${textRoles.metric}`}> {unitLabel} × </Text>
                ) : (
                  <Text className={`text-text-secondary ${textRoles.metric}`}> × </Text>
                )}
                <Text className={`text-text-primary ${textRoles.metric}`}>{set.reps}</Text>
                <Text className={`text-text-secondary ${textRoles.metric}`}> reps</Text>
                {comparison && priorSet && (
                  <SetProgressIndicator
                    setNumber={i + 1}
                    prev={priorSet}
                    current={set}
                    result={comparison}
                  />
                )}
                {(hasFail || hasRpe) && (
                  <View className={`rounded-md px-1 py-0.5 ${hasFail ? 'bg-danger/10' : 'bg-surface-2'}`}>
                    <Text className={`${textRoles.caption} ${hasFail ? 'text-danger' : 'text-text-secondary'}`}>
                      {hasFail && hasRpe ? `FAIL · RPE ${set.effort?.rpe}` : hasFail ? 'FAIL' : `RPE ${set.effort?.rpe}`}
                    </Text>
                  </View>
                )}
                {hasNotes && (
                  <View className="rounded-md px-1 py-0.5 bg-surface-2 max-w-[120px]">
                    <Text className={`text-text-secondary ${textRoles.caption}`} numberOfLines={1}>
                      {set.notes}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        );
      })}

      {extraCount > 0 && (
        <Text className={`text-text-disabled ${textRoles.caption} mt-1`}>+{extraCount} exercises</Text>
      )}

      <Text className={`text-text-disabled ${textRoles.caption} mt-2`}>{totalSets} sets total</Text>
    </TouchableOpacity>
  );
}
