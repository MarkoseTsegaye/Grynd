import React, { useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { formatShortDate } from '../../workout/../../shared/lib/date';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { formatWeight } from '../../../shared/lib/weight';
import { textRoles } from '../../../shared/theme/typography';
import { useHistoryStore } from '../store/historyStore';
import { compareSets } from '../lib/compareSetPerformance';
import { getPriorExerciseSets } from '../lib/getPriorExerciseSets';
import { SetProgressIndicator } from './SetProgressIndicator';
import type { WorkoutSession } from '../../workout/types';

interface Props {
  session: WorkoutSession;
}

export function SessionDetail({ session }: Props) {
  const { weightUnit, isLoaded: prefsLoaded, loadPrefs } = usePrefsStore();
  const { sessions } = useHistoryStore();

  useEffect(() => {
    if (!prefsLoaded) loadPrefs();
  }, [prefsLoaded, loadPrefs]);

  return (
    <ScrollView className="flex-1 bg-surface-0 px-5 pt-4" showsVerticalScrollIndicator={false}>
      {/* Level 1 header */}
      <View className="flex-row items-center justify-between mb-6">
        <Text className={`text-text-secondary ${textRoles.caption}`}>
          {formatShortDate(session.startedAt)}
        </Text>
        <Text className={`text-text-primary ${textRoles.cardTitleSmall}`} numberOfLines={1}>
          {session.splitName}
        </Text>
      </View>

      {session.exercises.map((exercise, exIdx) => {
        const priorSets = getPriorExerciseSets(session, exercise.exerciseId, sessions);
        return (
        <View key={exercise.exerciseId} className={`mb-3 ${exIdx > 0 ? 'border-t border-surface-2 pt-3' : ''}`}>
          {/* Level 2: exercise name */}
          <View className="flex-row items-center justify-between mb-1">
            <Text className={`text-text-primary ${textRoles.bodySmall}`}>{exercise.exerciseName}</Text>
            <Text className={`text-text-secondary ${textRoles.caption}`}>{exercise.sets.length} sets</Text>
          </View>
          {exercise.substitutedForExerciseName && (
            <Text className={`text-text-disabled ${textRoles.caption} mb-1`}>
              Substitute for {exercise.substitutedForExerciseName}
            </Text>
          )}

          {exercise.sets.length === 0 ? (
            <Text className={`text-text-disabled ${textRoles.caption} pl-4`}>No sets logged</Text>
          ) : (
            exercise.sets.map((set, i) => {
              const w = formatWeight(set.weightKg, weightUnit);
              const hasFail = set.effort?.toFailure;
              const hasRpe = set.effort?.rpe !== undefined;
              const hasNotes = !!set.notes;
              const priorSet = priorSets && i < priorSets.length ? priorSets[i] : null;
              const comparison = priorSet ? compareSets(priorSet, set) : null;
              return (
                <View key={`${set.loggedAt}-${i}`} className="pl-4 mb-2">
                  <View className="flex-row items-center gap-1 flex-wrap">
                    <Text className={`text-text-disabled ${textRoles.caption}`}>Set {i + 1}</Text>
                    <Text className={`text-text-primary ${textRoles.metric}`}> {w}</Text>
                    <Text className={`text-text-secondary ${textRoles.metric}`}> {weightUnit} × </Text>
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
                  </View>
                  {hasNotes && (
                    <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>
                      {set.notes}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>
        );
      })}
      <View className="h-8" />
    </ScrollView>
  );
}
