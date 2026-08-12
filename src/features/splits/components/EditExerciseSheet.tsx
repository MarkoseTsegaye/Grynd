import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { ExerciseAttributeControls } from './ExerciseAttributeControls';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import { colors } from '../../../shared/theme/colors';
import type { Exercise } from '../types';

interface Props {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  exercise: Exercise | null;
  onSave: (patch: {
    name: string;
    unilateral: boolean;
    plateLoaded: boolean;
  }) => Promise<void>;
  /** Removal lives here too, so editing and removing share one entry point. */
  onRemove?: (exercise: Exercise) => void;
  onClose: () => void;
}

export function EditExerciseSheet({ sheetRef, exercise, onSave, onRemove, onClose }: Props) {
  const snapPoints = useMemo(() => ['62%'], []);
  const [name, setName] = useState('');
  const [unilateral, setUnilateral] = useState(false);
  const [plateLoaded, setPlateLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!exercise) return;
    setName(exercise.name);
    setUnilateral(!!exercise.unilateral);
    setPlateLoaded(!!exercise.plateLoaded);
  }, [exercise]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || !exercise || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({ name: trimmed, unilateral, plateLoaded });
      sheetRef.current?.dismiss();
    } finally {
      setIsSaving(false);
    }
  }, [exercise, isSaving, name, onSave, plateLoaded, sheetRef, unilateral]);

  const canSave = name.trim().length > 0 && !isSaving;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: colors['surface-1'] }}
      handleIndicatorStyle={{ backgroundColor: colors['text-disabled'] }}
    >
      <BottomSheetView className="px-6 pb-8 pt-2">
        <Text className={`text-text-primary ${textRoles.modalTitle}`} accessibilityRole="header">
          {exercise?.name ?? 'Edit Exercise'}
        </Text>
        <Text className={`text-text-secondary ${textRoles.bodySmall} mt-1 mb-4`}>
          Changes apply to future sets. Sets already logged keep the values they were logged with.
        </Text>

        <Text
          className={`text-text-disabled ${textRoles.sectionLabel} mb-1.5`}
          style={{ fontSize: 10 }}
        >
          Name
        </Text>
        <TextInput
          className={`bg-surface-2 text-text-primary ${textRoles.body} rounded-lg px-4 py-3 mb-4`}
          value={name}
          onChangeText={setName}
          placeholder="Exercise name"
          placeholderTextColor={colors['text-disabled']}
          accessibilityLabel="Exercise name"
        />

        <View className="mb-4">
          <ExerciseAttributeControls
            unilateral={unilateral}
            plateLoaded={plateLoaded}
            onChangeUnilateral={setUnilateral}
            onChangePlateLoaded={setPlateLoaded}
            compact
          />
        </View>

        <TouchableOpacity
          className={`bg-accent rounded-lg py-4 items-center ${!canSave ? 'opacity-40' : ''}`}
          onPress={() => {
            void handleSave();
          }}
          disabled={!canSave}
          accessibilityLabel="Save exercise"
          activeOpacity={0.7}
        >
          <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>
            {isSaving ? 'Saving...' : 'Save changes'}
          </Text>
        </TouchableOpacity>

        {onRemove && exercise && (
          <TouchableOpacity
            className="rounded-lg py-3.5 mt-2 flex-row items-center justify-center gap-2"
            style={{ borderWidth: 1, borderColor: 'rgba(255, 76, 76, 0.4)' }}
            onPress={() => {
              sheetRef.current?.dismiss();
              onRemove(exercise);
            }}
            accessibilityLabel={`Remove ${exercise.name} from split`}
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Icon name="trash-can-outline" size={17} color="danger" />
            <Text className={`text-danger ${textRoles.buttonLabelSmall}`}>Remove from split</Text>
          </TouchableOpacity>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
