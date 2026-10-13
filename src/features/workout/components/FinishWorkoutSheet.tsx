import React, { useCallback, useMemo, useState, type RefObject } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutDatePicker } from './WorkoutDatePicker';
import { Button } from '../../../shared/components/Button';
import { Icon } from '../../../shared/components/Icon';
import {
  dateKeyToday,
  dateToCompletedAtMs,
  formatDisplayDate,
  isFutureCalendarDay,
  toDateKey,
} from '../../../shared/lib/date';
import { textRoles } from '../../../shared/theme/typography';
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
  // Index 0 is the confirm; index 1 only exists for the date picker.
  const snapPoints = useMemo(() => ['45%', '72%'], []);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exerciseCount = session.exercises.length;
  const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const isFutureDate = isFutureCalendarDay(selectedDate);
  const isToday = toDateKey(selectedDate) === dateKeyToday();
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
    setDatePickerOpen(false);
    setError(null);
  }, []);

  // The sheet grows only when the picker needs the room, so finishing on
  // today — nearly every time — is one tap with nothing to scroll past.
  const handleToggleDatePicker = useCallback(() => {
    setDatePickerOpen((open) => {
      sheetRef.current?.snapToIndex(open ? 0 : 1);
      return !open;
    });
  }, [sheetRef]);

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
      backgroundStyle={{ backgroundColor: '#141414' }}
      handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
    >
      {/* Inline padding rather than className: the BottomSheetView →
          gesture-handler → react-native-web chain drops NativeWind classes,
          so on web this content ran off both edges of the sheet. */}
      <BottomSheetView style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}>
        <Text
          className={`text-text-primary ${textRoles.cardTitleSmall} mb-1`}
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

        <TouchableOpacity
          className="flex-row items-center justify-center gap-1 h-11"
          onPress={handleToggleDatePicker}
          accessibilityLabel={`Change workout date, currently ${formatDisplayDate(selectedDate)}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: datePickerOpen }}
          activeOpacity={0.7}
        >
          <Text className={`text-text-secondary ${textRoles.bodySmall}`}>
            {isToday ? `Today · ${formatDisplayDate(selectedDate)}` : formatDisplayDate(selectedDate)}
          </Text>
          <Icon
            name={datePickerOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="text-secondary"
          />
        </TouchableOpacity>

        {datePickerOpen ? (
          <WorkoutDatePicker value={selectedDate} onChange={setSelectedDate} />
        ) : null}

        {isFutureDate && (
          <Text className={`text-danger ${textRoles.caption} mt-3 text-center`}>
            Workout date cannot be in the future
          </Text>
        )}
        {error && (
          <Text className={`text-danger ${textRoles.caption} mt-3 text-center`}>{error}</Text>
        )}

        <View className="flex-row gap-3 mt-6">
          <View className="flex-1">
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => sheetRef.current?.dismiss()}
              disabled={isConfirming}
              accessibilityLabel="Cancel finish workout"
            />
          </View>
          <View className="flex-1">
            <Button
              label="Confirm"
              onPress={() => void handleConfirm()}
              loading={isConfirming}
              disabled={!canConfirm}
              accessibilityLabel="Confirm finish workout"
            />
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
