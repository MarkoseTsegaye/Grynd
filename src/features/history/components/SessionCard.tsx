import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { formatShortDate } from '../../workout/../../shared/lib/date';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { formatWeight } from '../../../shared/lib/weight';
import { textRoles } from '../../../shared/theme/typography';
import type { WorkoutSession } from '../../workout/types';

interface Props {
  session: WorkoutSession;
  onPress: () => void;
}

export function SessionCard({ session, onPress }: Props) {
  const { weightUnit, isLoaded: prefsLoaded, loadPrefs } = usePrefsStore();

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
          {formatShortDate(session.startedAt)}
        </Text>
        <Text className={`text-text-primary ${textRoles.cardTitleSmall}`} numberOfLines={1}>
          {session.splitName}
        </Text>
      </View>

      {/* Level 2 + 3: exercises */}
      {visibleExercises.map((ex, exIdx) => (
        <View
          key={ex.exerciseId}
          className={`border-t border-surface-2 pt-2 ${exIdx < visibleExercises.length - 1 || extraCount > 0 ? 'mb-3' : 'mb-0'}`}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className={`text-text-primary ${textRoles.bodySmall}`}>{ex.exerciseName}</Text>
            <Text className={`text-text-secondary ${textRoles.caption}`}>{ex.sets.length} sets</Text>
          </View>
          {ex.sets.map((set, i) => {
            const w = formatWeight(set.weightKg, weightUnit);
            const hasFail = set.effort?.toFailure;
            const hasRpe = set.effort?.rpe !== undefined;
            return (
              <View key={`${set.loggedAt}-${i}`} className="flex-row items-center gap-1 pl-4 mb-1 flex-wrap">
                <Text className={`text-text-disabled ${textRoles.caption}`}>Set {i + 1}</Text>
                <Text className={`text-text-primary ${textRoles.metric}`}> {w}</Text>
                <Text className={`text-text-secondary ${textRoles.metric}`}> {weightUnit} × </Text>
                <Text className={`text-text-primary ${textRoles.metric}`}>{set.reps}</Text>
                <Text className={`text-text-secondary ${textRoles.metric}`}> reps</Text>
                {(hasFail || hasRpe) && (
                  <View className={`rounded-md px-1 py-0.5 ${hasFail ? 'bg-danger/10' : 'bg-surface-2'}`}>
                    <Text className={`${textRoles.caption} ${hasFail ? 'text-danger' : 'text-text-secondary'}`}>
                      {hasFail && hasRpe ? `FAIL · RPE ${set.effort?.rpe}` : hasFail ? 'FAIL' : `RPE ${set.effort?.rpe}`}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}

      {extraCount > 0 && (
        <Text className={`text-text-disabled ${textRoles.caption} mt-1`}>+{extraCount} exercises</Text>
      )}

      <Text className={`text-text-disabled ${textRoles.caption} mt-2`}>{totalSets} sets total</Text>
    </TouchableOpacity>
  );
}
