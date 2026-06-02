import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SetChip } from './SetChip';
import { RestTimerBar } from './RestTimerBar';
import type { LoggedExercise } from '../types';
import type { RestTimerStatus } from '../hooks/useRestTimer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../../shared/components/Icon';
import { formatShortDate } from '../../../shared/lib/date';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { formatWeight } from '../../../shared/lib/weight';
import { textRoles } from '../../../shared/theme/typography';

interface Props {
  exercise: LoggedExercise;
  exerciseIndex: number;
  totalExercises: number;
  isLastExercise: boolean;
  previousExercise: LoggedExercise | null;
  onOpenLog: () => void;
  onDeleteSet: (index: number) => void;
  onFinish: () => void;
  onCancel: () => void;
  onOpenOverview?: () => void;
  overviewDisabled?: boolean;
  onSubstitute?: () => void;
  substitutionLabel?: string;
  renderSwipeable?: (body: React.ReactNode) => React.ReactNode;
  restTimerStatus?: RestTimerStatus;
  restTimerRemainingMs?: number;
  restTimerVisible?: boolean;
  onRestTimerStart?: () => void;
  onRestTimerStop?: () => void;
  onRestTimerAdjustMinus?: () => void;
  onRestTimerAdjustPlus?: () => void;
  onRestTimerDismissComplete?: () => void;
}

const MAX_DOTS = 8;

function DotProgress({ current, total }: { current: number; total: number }) {
  let startIdx = 0;

  if (total > MAX_DOTS) {
    const half = Math.floor(MAX_DOTS / 2);
    startIdx = Math.max(0, Math.min(current - half, total - MAX_DOTS));
  }

  const endIdx = Math.min(startIdx + MAX_DOTS, total);
  const dots = Array.from({ length: endIdx - startIdx }, (_, i) => startIdx + i);

  return (
    <View className="flex-row items-center justify-center gap-1.5 mb-1">
      {dots.map((idx) => {
        const isActive = idx === current;
        const isCompleted = idx < current;
        // Dot sizes: active = 9px, normal = 6px (inline style needed for dynamic sizing)
        const size = isActive ? 9 : 6;
        const bg = isActive ? '#E8FF47' : isCompleted ? '#8A8580' : '#3D3B38';
        return (
          <View
            key={idx}
            style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }}
          />
        );
      })}
    </View>
  );
}

export function ExerciseScreen({
  exercise, exerciseIndex, totalExercises, isLastExercise, previousExercise,
  onOpenLog, onDeleteSet, onFinish, onCancel, onOpenOverview, overviewDisabled,
  onSubstitute, substitutionLabel,
  renderSwipeable,
  restTimerStatus, restTimerRemainingMs, restTimerVisible,
  onRestTimerStart, onRestTimerStop, onRestTimerAdjustMinus, onRestTimerAdjustPlus,
  onRestTimerDismissComplete,
}: Props) {
  const isFirst = exerciseIndex === 0;
  const { weightUnit } = usePrefsStore();

  const body = (
    <>
      {/* Swipe direction hints: left = forward, right = back */}
      <View className="flex-row items-center justify-between mb-2">
        <View style={{ width: 24 }}>
          {!isLastExercise && <Icon name="chevron-left" size={24} color="text-disabled" />}
          {isLastExercise && <Icon name="flag-checkered" size={24} color="text-disabled" />}
        </View>
        <View style={{ width: 24 }}>
          {!isFirst && <Icon name="chevron-right" size={24} color="text-disabled" />}
        </View>
      </View>

      <View className="flex-row items-start justify-between mb-1">
        <View className="flex-1 mr-2">
          <Text className={`text-text-primary ${textRoles.listTitle}`} numberOfLines={2}>
            {exercise.exerciseName}
          </Text>
          {substitutionLabel && (
            <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
              {substitutionLabel}
            </Text>
          )}
        </View>
        {onSubstitute && (
          <TouchableOpacity
            onPress={onSubstitute}
            accessibilityLabel="Substitute exercise"
            accessibilityRole="button"
            activeOpacity={0.7}
            className="pt-0.5"
          >
            <Text className={`text-accent ${textRoles.caption}`}>Substitute</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-row items-center mt-1 mb-4">
        <Text className={`text-accent ${textRoles.metricLarge}`}>{exercise.sets.length}</Text>
        <Text className={`text-text-secondary ${textRoles.bodyMono} ml-1`}>
          {exercise.sets.length === 1 ? 'set' : 'sets'}
        </Text>
      </View>

      {/* Previous performance panel */}
      {previousExercise && (
        <View className="bg-surface-1 rounded-lg px-4 py-3 mb-4 border border-surface-2">
          <View className="flex-row items-center justify-between mb-2">
            <Text className={`text-text-secondary ${textRoles.caption}`}>Last time</Text>
            <Text className={`text-text-secondary ${textRoles.caption}`}>
              {previousExercise.sets.length > 0
                ? formatShortDate(previousExercise.sets[0].loggedAt)
                : ''}
            </Text>
          </View>
          {previousExercise.sets.slice(0, 5).map((set, i) => {
            const w = formatWeight(set.weightKg, weightUnit);
            const unit = weightUnit;
            const hasFail = set.effort?.toFailure;
            const hasRpe = set.effort?.rpe !== undefined;
            const hasNotes = !!set.notes;
            return (
              <View key={`prev-${i}`} className="flex-row items-center gap-1 mb-0.5 flex-wrap">
                <Text className={`text-text-disabled ${textRoles.caption}`}>Set {i + 1}</Text>
                <Text className={`text-text-primary ${textRoles.metric}`}> {w}</Text>
                <Text className={`text-text-secondary ${textRoles.metric}`}> {unit} × </Text>
                <Text className={`text-text-primary ${textRoles.metric}`}>{set.reps}</Text>
                <Text className={`text-text-secondary ${textRoles.metric}`}> reps</Text>
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
          {previousExercise.sets.length > 5 && (
            <Text className={`text-text-disabled ${textRoles.caption} mt-1`}>
              +{previousExercise.sets.length - 5} more
            </Text>
          )}
        </View>
      )}

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-row flex-wrap">
          {exercise.sets.map((set, i) => (
            <SetChip
              key={`${set.loggedAt}-${i}`}
              setNumber={i + 1}
              set={set}
              onDelete={() => onDeleteSet(i)}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-0 px-5 pt-4 pb-8">
      {/* Header row: cancel + progress + finish */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity
          onPress={onCancel}
          accessibilityLabel="Cancel workout"
          activeOpacity={0.7}
          className="p-1"
        >
          <Icon name="close" size={24} color="text-secondary" />
        </TouchableOpacity>

        <View className="flex-1 items-center">
          <DotProgress current={exerciseIndex} total={totalExercises} />
          <View className="flex-row items-center gap-1.5">
            <Icon name="dumbbell" size={14} color="text-secondary" />
            <Text className={`text-text-secondary ${textRoles.captionMono}`}>
              {exerciseIndex + 1} / {totalExercises}
            </Text>
          </View>
          {onOpenOverview && (
            <TouchableOpacity
              onPress={onOpenOverview}
              disabled={overviewDisabled}
              accessibilityLabel="View all exercises"
              accessibilityRole="button"
              accessibilityState={{ disabled: overviewDisabled }}
              activeOpacity={0.7}
              className={`mt-1 ${overviewDisabled ? 'opacity-40' : ''}`}
            >
              <Text className={`text-accent ${textRoles.caption}`}>View all</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLastExercise ? (
          <TouchableOpacity
            className="bg-success rounded-lg px-3 py-2 flex-row items-center gap-1"
            onPress={onFinish}
            accessibilityLabel="Finish workout"
            activeOpacity={0.7}
          >
            <Icon name="flag-checkered" size={18} color="surface-0" />
            <Text className={`text-surface-0 ${textRoles.buttonLabelSmall}`}>Finish</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 68 }} />
        )}
      </View>

      <View className="flex-1">
        {renderSwipeable ? renderSwipeable(body) : body}
      </View>

      {restTimerVisible &&
        restTimerStatus &&
        restTimerRemainingMs !== undefined &&
        onRestTimerStart &&
        onRestTimerStop &&
        onRestTimerAdjustMinus &&
        onRestTimerAdjustPlus &&
        onRestTimerDismissComplete && (
          <RestTimerBar
            status={restTimerStatus}
            remainingMs={restTimerRemainingMs}
            onStart={onRestTimerStart}
            onStop={onRestTimerStop}
            onAdjustMinus={onRestTimerAdjustMinus}
            onAdjustPlus={onRestTimerAdjustPlus}
            onDismissComplete={onRestTimerDismissComplete}
          />
        )}

      <TouchableOpacity
        className="bg-surface-1 border border-text-disabled rounded-lg py-5 flex-row items-center justify-center gap-2 mt-4"
        onPress={onOpenLog}
        accessibilityLabel="Log a set"
        activeOpacity={0.7}
      >
        <Icon name="plus-circle-outline" size={20} color="accent" />
        <Text className={`text-accent ${textRoles.actionLabel}`}>Set</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
