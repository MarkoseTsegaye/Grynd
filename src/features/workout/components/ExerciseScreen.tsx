import React from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { RestTimerBar } from './RestTimerBar';
import { SetTable } from './SetTable';
import { LogPad } from './LogPad';
import type { LoggedExercise } from '../types';
import type { RestTimerStatus } from '../hooks/useRestTimer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../../shared/components/Icon';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import { textRoles } from '../../../shared/theme/typography';

interface Props {
  exercise: LoggedExercise;
  exerciseIndex: number;
  totalExercises: number;
  isLastExercise: boolean;
  previousExercise: LoggedExercise | null;

  // Log pad
  weightMode: 'straight' | 'plates';
  padCollapsed: boolean;
  onTogglePad: () => void;
  weightValue: string;
  repValue: string;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  computedWeightKg: number;
  plates: Record<number, number>;
  plateList: number[];
  onAddPlate: (weight: number) => void;
  onRemovePlate: (weight: number) => void;
  onClearPlates: () => void;
  onToggleUnit: () => void;
  toFailure: boolean;
  onToggleFailure: () => void;
  rir: number | undefined;
  onChangeRir: (rir: number | undefined) => void;
  notes: string;
  onChangeNotes: (notes: string) => void;
  isUnilateral: boolean;
  setSide: 'left' | 'right';
  onChangeSide: (side: 'left' | 'right') => void;
  isLogging: boolean;
  onLog: () => void;

  // Sets
  editingSetIndex: number | null;
  onEditSet: (index: number) => void;
  onCancelEdit: () => void;
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
  restTimerProgress?: number;
  restTimerVisible?: boolean;
  onRestTimerToggle?: () => void;
  onRestTimerAdjustPlus?: () => void;
  onRestTimerDismiss?: () => void;
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
    <View className="flex-row items-center justify-center gap-1.5">
      {dots.map((idx) => {
        const isActive = idx === current;
        const isCompleted = idx < current;
        // Inline style: the active dot is a wider pill, so size is dynamic.
        const width = isActive ? 16 : 5;
        const bg = isActive ? '#E8FF47' : isCompleted ? '#8A8580' : '#3D3B38';
        return (
          <View
            key={idx}
            style={{ width, height: 5, borderRadius: 3, backgroundColor: bg }}
          />
        );
      })}
    </View>
  );
}

export function ExerciseScreen({
  exercise, exerciseIndex, totalExercises, isLastExercise, previousExercise,
  weightMode, padCollapsed, onTogglePad,
  weightValue, repValue, onChangeWeight, onChangeReps,
  computedWeightKg, plates, plateList, onAddPlate, onRemovePlate, onClearPlates, onToggleUnit,
  toFailure, onToggleFailure, rir, onChangeRir, notes, onChangeNotes,
  isUnilateral, setSide, onChangeSide,
  isLogging, onLog,
  editingSetIndex, onEditSet, onCancelEdit, onDeleteSet,
  onFinish, onCancel, onOpenOverview, overviewDisabled,
  onSubstitute, substitutionLabel,
  renderSwipeable,
  restTimerStatus, restTimerRemainingMs, restTimerProgress, restTimerVisible,
  onRestTimerToggle, onRestTimerAdjustPlus, onRestTimerDismiss,
}: Props) {
  const { weightUnit } = usePrefsStore();

  const body = (
    <>
      <View className="flex-row items-center gap-2 mb-1">
        <Text className="flex-1 text-text-primary font-sans-bold text-xl" numberOfLines={1}>
          {exercise.exerciseName}
        </Text>
        {onSubstitute && (
          <TouchableOpacity
            onPress={onSubstitute}
            accessibilityLabel="Substitute exercise"
            accessibilityRole="button"
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Icon name="swap-horizontal" size={20} color="accent" />
          </TouchableOpacity>
        )}
      </View>

      {substitutionLabel && (
        <Text className={`text-text-disabled ${textRoles.caption} mb-1`} numberOfLines={1}>
          {substitutionLabel}
        </Text>
      )}

      <SetTable
        sets={exercise.sets}
        previousSets={previousExercise?.sets ?? []}
        weightUnit={weightUnit}
        editingSetIndex={editingSetIndex}
        onEditSet={onEditSet}
        onDeleteSet={onDeleteSet}
      />
    </>
  );

  return (
    // SafeAreaView writes its own inset padding, which clobbers className
    // padding — so the screen's own gutters live on an inner View.
    <SafeAreaView className="flex-1 bg-surface-0">
      <View className="flex-1 px-4 pt-2 pb-4">
      {/* Header: cancel · progress · finish */}
      <View className="flex-row items-center justify-between mb-2 gap-2">
        <TouchableOpacity
          onPress={onCancel}
          accessibilityLabel="Cancel workout"
          accessibilityRole="button"
          activeOpacity={0.7}
          className="bg-surface-1 rounded-lg items-center justify-center"
          style={{ width: 34, height: 34 }}
        >
          <Icon name="close" size={18} color="text-secondary" />
        </TouchableOpacity>

        <View className="flex-1 items-center gap-1">
          <DotProgress current={exerciseIndex} total={totalExercises} />
          <TouchableOpacity
            onPress={onOpenOverview}
            disabled={overviewDisabled || !onOpenOverview}
            accessibilityLabel="View all exercises"
            accessibilityRole="button"
            activeOpacity={0.7}
            className={overviewDisabled ? 'opacity-40' : ''}
          >
            <Text className={`text-text-disabled ${textRoles.captionMono}`} style={{ fontSize: 11 }}>
              {exerciseIndex + 1} / {totalExercises} · View all
            </Text>
          </TouchableOpacity>
        </View>

        {isLastExercise ? (
          <TouchableOpacity
            className="bg-success rounded-lg px-3 flex-row items-center gap-1"
            style={{ height: 34 }}
            onPress={onFinish}
            accessibilityLabel="Finish workout"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Icon name="flag-checkered" size={16} color="surface-0" />
            <Text className={`text-surface-0 ${textRoles.buttonLabelSmall}`}>Finish</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 34 }} />
        )}
      </View>

      <View className="flex-1">
        {renderSwipeable ? renderSwipeable(body) : body}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {restTimerVisible &&
          restTimerStatus &&
          restTimerRemainingMs !== undefined &&
          onRestTimerToggle &&
          onRestTimerAdjustPlus &&
          onRestTimerDismiss && (
            <RestTimerBar
              status={restTimerStatus}
              remainingMs={restTimerRemainingMs}
              progress={restTimerProgress ?? 0}
              onToggle={onRestTimerToggle}
              onAdjustPlus={onRestTimerAdjustPlus}
              onDismiss={onRestTimerDismiss}
            />
          )}

        <LogPad
          mode={weightMode}
          collapsed={padCollapsed}
          onToggleCollapsed={onTogglePad}
          weightValue={weightValue}
          repValue={repValue}
          weightUnit={weightUnit}
          onChangeWeight={onChangeWeight}
          onChangeReps={onChangeReps}
          computedWeightKg={computedWeightKg}
          plates={plates}
          plateList={plateList}
          onAddPlate={onAddPlate}
          onRemovePlate={onRemovePlate}
          onClearPlates={onClearPlates}
          onToggleUnit={onToggleUnit}
          toFailure={toFailure}
          onToggleFailure={onToggleFailure}
          rir={rir}
          onChangeRir={onChangeRir}
          notes={notes}
          onChangeNotes={onChangeNotes}
          isUnilateral={isUnilateral}
          setSide={setSide}
          onChangeSide={onChangeSide}
          isEditing={editingSetIndex !== null}
          isLogging={isLogging}
          onLog={onLog}
          onCancelEdit={onCancelEdit}
        />
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
