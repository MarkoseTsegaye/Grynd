import React, { useCallback, useMemo, useState, type RefObject } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutDatePicker } from './WorkoutDatePicker';
import { dateToCompletedAtMs, isFutureCalendarDay } from '../../../shared/lib/date';
import { textRoles } from '../../../shared/theme/typography';
import { colors } from '../../../shared/theme/colors';
import type { WorkoutSession } from '../types';

interface Props {
  session: WorkoutSession;
  sheetRef: RefObject<BottomSheetModal | null>;
  onConfirm: (completedAt: number) => Promise<void>;
  onCancel: () => void;
  onChange: (index: number) => void;
}

export function FinishWorkoutSheet({
  session,
  sheetRef,
  onConfirm,
  onCancel,
  onChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['72%'], []);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exerciseCount = session.exercises.length;
  const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const isFutureDate = isFutureCalendarDay(selectedDate);
  const canConfirm = !isFutureDate && !isConfirming;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const resetState = useCallback(() => {
    setSelectedDate(new Date());
    setIsConfirming(false);
    setError(null);
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      onChange(index);
      if (index < 0) {
        resetState();
      }
    },
    [onChange, resetState],
  );

  const handleDismiss = useCallback(() => {
    resetState();
    onCancel();
  }, [onCancel, resetState]);

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;

    setIsConfirming(true);
    setError(null);
    const completedAt = dateToCompletedAtMs(selectedDate, session.startedAt);

    try {
      await onConfirm(completedAt);
    } catch {
      setError('Could not save workout. Try again.');
      setIsConfirming(false);
    }
  }, [canConfirm, onConfirm, selectedDate, session.startedAt]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableHandlePanningGesture={false}
      enableContentPanningGesture={false}
      bottomInset={insets.bottom}
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
      onDismiss={handleDismiss}
      backgroundStyle={{ backgroundColor: colors['surface-1'] }}
      handleIndicatorStyle={{ backgroundColor: colors['text-disabled'] }}
    >
      <BottomSheetView className="px-6 pb-8 pt-2">
        <Text
          className={`text-text-primary ${textRoles.modalTitle} mb-1`}
          accessibilityRole="header"
        >
          Finish Workout
        </Text>
        <Text className={`text-text-secondary ${textRoles.bodySmall} mb-4`} numberOfLines={1}>
          {session.splitName}
        </Text>

        <View className="flex-row justify-between mb-4 px-1">
          <Text className={`text-text-secondary ${textRoles.caption}`}>
            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
          </Text>
          <Text className={`text-text-secondary ${textRoles.caption}`}>
            {totalSets} {totalSets === 1 ? 'set' : 'sets'}
          </Text>
        </View>

        <Text className={`text-text-secondary ${textRoles.fieldLabel} mb-2 px-1`}>WORKOUT DATE</Text>
        <WorkoutDatePicker value={selectedDate} onChange={setSelectedDate} />

        {isFutureDate && (
          <Text className={`text-danger ${textRoles.caption} mt-3 text-center`}>
            Workout date cannot be in the future
          </Text>
        )}
        {error && (
          <Text className={`text-danger ${textRoles.caption} mt-3 text-center`}>{error}</Text>
        )}

        <View className="flex-row gap-3 mt-6">
          <TouchableOpacity
            className="flex-1 bg-surface-2 rounded-lg py-4 items-center"
            onPress={() => sheetRef.current?.dismiss()}
            disabled={isConfirming}
            accessibilityLabel="Cancel finish workout"
            activeOpacity={0.7}
          >
            <Text className={`text-text-primary ${textRoles.buttonLabel}`}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 bg-accent rounded-lg py-4 items-center ${!canConfirm ? 'opacity-40' : ''}`}
            onPress={() => void handleConfirm()}
            disabled={!canConfirm}
            accessibilityLabel="Confirm finish workout"
            activeOpacity={0.7}
          >
            {isConfirming ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>Confirm</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
