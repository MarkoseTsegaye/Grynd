import React, { useCallback, useMemo, type RefObject } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import type { LoggedExercise } from '../types';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  exercises: LoggedExercise[];
  currentExerciseIndex: number;
  onSelectExercise: (index: number) => void;
  onChange: (index: number) => void;
}

type RowState = 'current' | 'completed' | 'upcoming';

function getRowState(index: number, currentIndex: number, setCount: number): RowState {
  if (index === currentIndex) return 'current';
  if (setCount > 0) return 'completed';
  return 'upcoming';
}

function formatSetCount(count: number): string {
  if (count === 0) return '0 sets';
  return count === 1 ? '1 set' : `${count} sets`;
}

export function ExerciseOverviewSheet({
  sheetRef,
  exercises,
  currentExerciseIndex,
  onSelectExercise,
  onChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['50%', '85%'], []);
  const total = exercises.length;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const handleSelect = useCallback(
    (index: number) => {
      onSelectExercise(index);
      sheetRef.current?.dismiss();
    },
    [onSelectExercise, sheetRef],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: LoggedExercise; index: number }) => {
      const state = getRowState(index, currentExerciseIndex, item.sets.length);
      const setCountLabel = formatSetCount(item.sets.length);
      const positionLabel = `${index + 1} / ${total}`;
      const stateLabel =
        state === 'current' ? 'current' : state === 'completed' ? 'completed' : 'upcoming';

      const rowClass =
        state === 'current'
          ? 'bg-surface-2 border border-accent'
          : state === 'completed'
            ? 'bg-surface-2'
            : 'bg-surface-1';

      return (
        <TouchableOpacity
          className={`py-3 px-4 rounded-lg mb-2 flex-row items-center gap-3 ${rowClass}`}
          onPress={() => handleSelect(index)}
          accessibilityLabel={`${item.exerciseName}, ${positionLabel}, ${setCountLabel}, ${stateLabel}`}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text className={`text-text-secondary ${textRoles.captionMono}`}>
            {index + 1}
          </Text>
          <View className="flex-1">
            <Text
              className={`${textRoles.bodySmall} ${state === 'current' ? 'text-accent' : state === 'upcoming' ? 'text-text-disabled' : 'text-text-primary'}`}
              numberOfLines={1}
            >
              {item.exerciseName}
            </Text>
            {item.substitutedForExerciseName && (
              <Text className={`text-text-disabled ${textRoles.caption}`} numberOfLines={1}>
                Sub for {item.substitutedForExerciseName}
              </Text>
            )}
          </View>
          <Text
            className={`${textRoles.caption} ${state === 'completed' ? 'text-text-primary' : 'text-text-secondary'}`}
          >
            {setCountLabel}
          </Text>
          {state === 'current' && <Icon name="chevron-right" size={18} color="accent" />}
          {state === 'completed' && (
            <Icon name="check-circle-outline" size={18} color="text-secondary" />
          )}
        </TouchableOpacity>
      );
    },
    [currentExerciseIndex, handleSelect, total],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      bottomInset={insets.bottom}
      onChange={onChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#141414' }}
      handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
    >
      <View accessibilityViewIsModal className="flex-1">
        <View className="px-5 pt-2 pb-3">
          <Text
            className={`text-text-secondary ${textRoles.bodySmall}`}
            accessibilityRole="header"
            accessibilityLabel="All exercises"
          >
            All exercises
          </Text>
        </View>
        <BottomSheetFlatList
          data={exercises}
          keyExtractor={(item) => item.exerciseId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        />
      </View>
    </BottomSheetModal>
  );
}
