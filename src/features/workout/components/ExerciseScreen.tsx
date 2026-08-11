import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SetChip } from './SetChip';
import { RestTimerBar } from './RestTimerBar';
import { QuickLogBar } from './QuickLogBar';
import { PlateLogBar } from './PlateLogBar';
import type { LoggedExercise } from '../types';
import type { RestTimerStatus } from '../hooks/useRestTimer';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../shared/components/Icon';
import { formatShortDate } from '../../../shared/lib/date';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { formatSetWeightDisplay } from '../../../shared/lib/weight';
import { textRoles } from '../../../shared/theme/typography';

interface Props {
  exercise: LoggedExercise;
  exerciseIndex: number;
  totalExercises: number;
  isLastExercise: boolean;
  previousExercise: LoggedExercise | null;
  onOpenLog: () => void;
  // Quick-log keypad (fast straight-weight path)
  weightValue: string;
  repValue: string;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  toFailure: boolean;
  onToggleFailure: () => void;
  isLogging: boolean;
  onQuickLog: () => void;
  // Plate-loaded path
  computedWeightKg: number;
  plates: Record<number, number>;
  plateList: number[];
  onAddPlate: (weight: number) => void;
  onRemovePlate: (weight: number) => void;
  onClearPlates: () => void;
  onToggleUnit: () => void;
  onEditSet: (index: number) => void;
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
  onOpenLog,
  weightValue, repValue, onChangeWeight, onChangeReps,
  toFailure, onToggleFailure, isLogging, onQuickLog,
  computedWeightKg, plates, plateList, onAddPlate, onRemovePlate, onClearPlates, onToggleUnit,
  onEditSet, onDeleteSet, onFinish, onCancel, onOpenOverview, overviewDisabled,
  onSubstitute, substitutionLabel,
  renderSwipeable,
  restTimerStatus, restTimerRemainingMs, restTimerVisible,
  onRestTimerStart, onRestTimerStop, onRestTimerAdjustMinus, onRestTimerAdjustPlus,
  onRestTimerDismissComplete,
}: Props) {
  const isFirst = exerciseIndex === 0;
  const { weightUnit } = usePrefsStore();
  const insets = useSafeAreaInsets();
  // On web, SafeAreaView adds insets.top plus the pt-4 constant, which after
  // viewport-fit=cover became ~63 px on iOS PWA — too much vertical space
  // above the header. Bypass SafeAreaView's automatic top padding on web and
  // set it explicitly. Also pass horizontal padding through inline style
  // rather than relying on className: SafeAreaView.web rebuilds its own
  // paddingStyle from `style` and the className-derived styles can get lost
  // in that merge — being explicit here is bulletproof.
  const webContainerStyle =
    Platform.OS === 'web'
      ? { paddingTop: insets.top + 4, paddingLeft: 20, paddingRight: 20 }
      : undefined;

  const hasPrev = !!previousExercise && previousExercise.sets.length > 0;
  const prevDate = hasPrev ? formatShortDate(previousExercise!.sets[0].loggedAt) : null;
  const prevSummary = hasPrev
    ? previousExercise!.sets
        .map((s) => `${formatSetWeightDisplay(s, weightUnit).weightText}×${s.reps}`)
        .join('   ·   ')
    : '';

  const body = (
    <>
      {/* Compact header: title · sets badge · substitute + swipe affordances */}
      <View className="flex-row items-center mb-1">
        <View style={{ width: 18 }}>
          {!isLastExercise && <Icon name="chevron-left" size={18} color="text-disabled" />}
          {isLastExercise && <Icon name="flag-checkered" size={18} color="text-disabled" />}
        </View>
        <Text
          className={`flex-1 text-text-primary font-sans-bold text-xl mx-1`}
          numberOfLines={1}
        >
          {exercise.exerciseName}
        </Text>
        <View className="bg-surface-1 rounded-md px-2 py-0.5 mr-1">
          <Text className={`text-text-secondary ${textRoles.metric}`}>
            {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
          </Text>
        </View>
        {onSubstitute && (
          <TouchableOpacity
            onPress={onSubstitute}
            accessibilityLabel="Substitute exercise"
            accessibilityRole="button"
            activeOpacity={0.7}
            hitSlop={8}
            className="p-1"
          >
            <Icon name="swap-horizontal" size={20} color="accent" />
          </TouchableOpacity>
        )}
        <View style={{ width: 18 }} className="items-end">
          {!isFirst && <Icon name="chevron-right" size={18} color="text-disabled" />}
        </View>
      </View>

      {substitutionLabel && (
        <Text className={`text-text-secondary ${textRoles.caption} mb-1`} numberOfLines={1}>
          {substitutionLabel}
        </Text>
      )}

      {/* One-line "last time" reference */}
      {hasPrev && (
        <View className="flex-row items-baseline mb-2">
          <Text className={`text-text-disabled ${textRoles.caption} mr-2`}>Last {prevDate}</Text>
          <Text
            className={`flex-1 text-text-secondary ${textRoles.metric}`}
            numberOfLines={1}
          >
            {prevSummary}
          </Text>
        </View>
      )}

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-row flex-wrap">
          {exercise.sets.map((set, i) => (
            <SetChip
              key={`${set.loggedAt}-${i}`}
              setNumber={i + 1}
              set={set}
              previousSet={previousExercise?.sets[i]}
              onPress={() => onEditSet(i)}
              onDelete={() => onDeleteSet(i)}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );

  return (
    <SafeAreaView
      edges={Platform.OS === 'web' ? ['bottom'] : undefined}
      className="flex-1 bg-surface-0 px-5 pt-4 pb-8"
      style={webContainerStyle}
    >
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

      {exercise.plateLoaded ? (
        <PlateLogBar
          computedWeightKg={computedWeightKg}
          weightUnit={weightUnit}
          plates={plates}
          plateList={plateList}
          onAddPlate={onAddPlate}
          onRemovePlate={onRemovePlate}
          onClearPlates={onClearPlates}
          onToggleUnit={onToggleUnit}
          repValue={repValue}
          onChangeReps={onChangeReps}
          toFailure={toFailure}
          onToggleFailure={onToggleFailure}
          isLogging={isLogging}
          onLog={onQuickLog}
          onMore={onOpenLog}
        />
      ) : (
        <QuickLogBar
          weightValue={weightValue}
          repValue={repValue}
          weightUnit={weightUnit}
          onChangeWeight={onChangeWeight}
          onChangeReps={onChangeReps}
          toFailure={toFailure}
          onToggleFailure={onToggleFailure}
          isLogging={isLogging}
          onLog={onQuickLog}
          onMore={onOpenLog}
        />
      )}
    </SafeAreaView>
  );
}
