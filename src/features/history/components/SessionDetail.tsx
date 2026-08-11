import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { formatShortDate } from '../../../shared/lib/date';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { textRoles } from '../../../shared/theme/typography';
import { useHistoryStore } from '../store/historyStore';
import { getPriorExerciseSets } from '../lib/getPriorExerciseSets';
import { getSessionSummary, pluralize } from '../lib/sessionSummary';
import { SetRow } from './SetRow';
import { SessionSummaryStrip } from './SessionSummaryStrip';
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

  const summary = useMemo(() => getSessionSummary(session, weightUnit), [session, weightUnit]);

  // Resolve each exercise's prior-session sets once per session/history change
  // instead of re-scanning all sessions on every render.
  const priorSetsByExerciseId = useMemo(() => {
    const map: Record<string, ReturnType<typeof getPriorExerciseSets>> = {};
    for (const exercise of session.exercises) {
      const lookupId = exercise.substitutedForExerciseId ?? exercise.exerciseId;
      map[exercise.exerciseId] = getPriorExerciseSets(session, lookupId, sessions);
    }
    return map;
  }, [session, sessions]);

  return (
    <ScrollView className="flex-1 bg-surface-0 px-5 pt-4" showsVerticalScrollIndicator={false}>
      {/* Header + at-a-glance totals */}
      <View className="flex-row items-baseline gap-2">
        <Text className={`text-text-primary ${textRoles.cardTitle}`} numberOfLines={1}>
          {session.splitName}
        </Text>
        <Text className={`text-text-disabled ${textRoles.caption}`}>
          · {formatShortDate(session.completedAt ?? session.startedAt)}
        </Text>
      </View>
      <SessionSummaryStrip summary={summary} />

      {session.exercises.map((exercise, exIdx) => {
        const priorSets = priorSetsByExerciseId[exercise.exerciseId];
        return (
          <View
            key={exercise.exerciseId}
            className={`mb-2 ${exIdx > 0 ? 'border-t border-surface-2 pt-3 mt-1' : 'pt-2'}`}
          >
            <View className="flex-row items-baseline justify-between">
              <Text
                className={`flex-1 text-text-primary ${textRoles.listItemTitle}`}
                numberOfLines={1}
              >
                {exercise.exerciseName}
              </Text>
              <Text className={`text-text-disabled ${textRoles.caption} ml-2`}>
                {pluralize(exercise.sets.length, 'set')}
              </Text>
            </View>

            {exercise.substitutedForExerciseName && (
              <Text className={`text-text-disabled ${textRoles.caption} mb-1`}>
                Substitute for {exercise.substitutedForExerciseName}
              </Text>
            )}

            {exercise.sets.length === 0 ? (
              <Text className={`text-text-disabled ${textRoles.caption} pl-4 py-1`}>
                No sets logged
              </Text>
            ) : (
              exercise.sets.map((set, i) => (
                <SetRow
                  key={`${set.loggedAt}-${i}`}
                  setNumber={i + 1}
                  set={set}
                  priorSet={priorSets && i < priorSets.length ? priorSets[i] : null}
                  weightUnit={weightUnit}
                />
              ))
            )}
          </View>
        );
      })}
      <View className="h-8" />
    </ScrollView>
  );
}
