import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { formatShortDate } from '../../../shared/lib/date';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { textRoles } from '../../../shared/theme/typography';
import { Icon } from '../../../shared/components/Icon';
import { useHistoryStore } from '../store/historyStore';
import { getPriorExerciseSets } from '../lib/getPriorExerciseSets';
import { getSessionSummary, pluralize } from '../lib/sessionSummary';
import { SetRow } from './SetRow';
import { SessionSummaryStrip } from './SessionSummaryStrip';
import type { WorkoutSession } from '../../workout/types';

interface Props {
  session: WorkoutSession;
  onPress: () => void;
}

const PREVIEW_EXERCISE_COUNT = 3;

export function SessionCard({ session, onPress }: Props) {
  const { weightUnit, isLoaded: prefsLoaded, loadPrefs } = usePrefsStore();
  const { sessions } = useHistoryStore();

  useEffect(() => {
    if (!prefsLoaded) loadPrefs();
  }, [prefsLoaded, loadPrefs]);

  const summary = useMemo(
    () => getSessionSummary(session, weightUnit),
    [session, weightUnit],
  );

  // Resolve prior sets once per session/history change rather than on every render.
  const priorSetsByExerciseId = useMemo(() => {
    const map: Record<string, ReturnType<typeof getPriorExerciseSets>> = {};
    for (const exercise of session.exercises.slice(0, PREVIEW_EXERCISE_COUNT)) {
      const lookupId = exercise.substitutedForExerciseId ?? exercise.exerciseId;
      map[exercise.exerciseId] = getPriorExerciseSets(session, lookupId, sessions);
    }
    return map;
  }, [session, sessions]);

  const visibleExercises = session.exercises.slice(0, PREVIEW_EXERCISE_COUNT);
  const extraCount = session.exercises.length - visibleExercises.length;

  return (
    <TouchableOpacity
      className="bg-surface-1 rounded-lg px-4 pt-3 mb-4"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${session.splitName}, ${formatShortDate(session.completedAt ?? session.startedAt)}, ${summary.setCountText} — open full session`}
      activeOpacity={0.7}
    >
      {/* Header: what and when */}
      <View className="flex-row items-baseline gap-2">
        <Text className={`text-text-primary ${textRoles.cardTitle}`} numberOfLines={1}>
          {session.splitName}
        </Text>
        <Text className={`text-text-disabled ${textRoles.caption}`}>
          · {formatShortDate(session.completedAt ?? session.startedAt)}
        </Text>
      </View>

      <SessionSummaryStrip summary={summary} />

      {visibleExercises.map((exercise, exIdx) => {
        const priorSets = priorSetsByExerciseId[exercise.exerciseId];
        return (
          <View
            key={exercise.exerciseId}
            className={exIdx > 0 ? 'border-t border-surface-2 pt-2 mt-1' : 'pt-1'}
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

            {exercise.sets.map((set, i) => (
              <SetRow
                key={`${set.loggedAt}-${i}`}
                setNumber={i + 1}
                set={set}
                priorSet={priorSets && i < priorSets.length ? priorSets[i] : null}
                weightUnit={weightUnit}
              />
            ))}
          </View>
        );
      })}

      {/* Tap-through affordance — the card was already tappable but never said so */}
      <View className="flex-row items-center justify-center gap-1 border-t border-surface-2 mt-2 py-3">
        <Text className={`text-accent ${textRoles.toggleLabel}`}>
          View full session
          {extraCount > 0 ? ` · +${pluralize(extraCount, 'exercise')}` : ''}
        </Text>
        <Icon name="chevron-right" size={16} color="accent" />
      </View>
    </TouchableOpacity>
  );
}
