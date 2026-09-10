import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { formatShortDate } from '../../../shared/lib/date';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { textRoles } from '../../../shared/theme/typography';
import { Icon } from '../../../shared/components/Icon';
import { useHistoryStore } from '../store/historyStore';
import { getPriorExerciseSets } from '../lib/getPriorExerciseSets';
import { summarizeExerciseLine, type ExerciseLine } from '../lib/exerciseLine';
import { getSessionSummary, pluralize } from '../lib/sessionSummary';
import { ExerciseDeltaChip } from './ExerciseDeltaChip';
import { SessionSummaryStrip } from './SessionSummaryStrip';
import type { WorkoutSession } from '../../workout/types';

interface Props {
  session: WorkoutSession;
  onPress: () => void;
}

/**
 * Each exercise is one ~38 px row now rather than a stack of set rows, so a
 * card can show five without turning into a screenful.
 */
const PREVIEW_EXERCISE_COUNT = 5;

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

  // One line per exercise, resolved once per session/history/unit change
  // rather than on every render.
  const lines = useMemo(() => {
    const rows: { key: string; name: string; line: ExerciseLine }[] = [];
    for (const exercise of session.exercises.slice(0, PREVIEW_EXERCISE_COUNT)) {
      const lookupId = exercise.substitutedForExerciseId ?? exercise.exerciseId;
      const priorSets = getPriorExerciseSets(session, lookupId, sessions);
      const line = summarizeExerciseLine(exercise, priorSets, weightUnit);
      if (line === null) continue;
      rows.push({ key: exercise.exerciseId, name: exercise.exerciseName, line });
    }
    return rows;
  }, [session, sessions, weightUnit]);

  // Counts both truncated exercises and any that logged no sets, since
  // neither is represented above and both are on the detail screen.
  const extraCount = session.exercises.length - lines.length;

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
        <Text className={`text-text-secondary ${textRoles.caption}`}>
          · {formatShortDate(session.completedAt ?? session.startedAt)}
        </Text>
      </View>

      <SessionSummaryStrip summary={summary} />

      {lines.map(({ key, name, line }, index) => (
        <View
          key={key}
          className={`flex-row items-center gap-2 py-1.5 ${index > 0 ? 'border-t border-surface-2' : ''}`}
        >
          <Text
            className={`flex-1 text-text-primary ${textRoles.listItemTitle}`}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text className={`text-text-secondary ${textRoles.metric}`}>
            {line.setsText} @ {line.topSetText}
          </Text>
          <ExerciseDeltaChip delta={line.delta} />
        </View>
      ))}

      {/* Tap-through affordance — the card was already tappable but never said so */}
      <View className="flex-row items-center justify-center gap-1 border-t border-surface-2 mt-1.5 py-3">
        <Text className={`text-accent ${textRoles.toggleLabel}`}>
          View session
          {extraCount > 0 ? ` · +${pluralize(extraCount, 'exercise')}` : ''}
        </Text>
        <Icon name="chevron-right" size={16} color="accent" />
      </View>
    </TouchableOpacity>
  );
}
