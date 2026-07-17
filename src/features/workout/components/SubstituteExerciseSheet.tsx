import React, { useCallback, useMemo, useState, type RefObject } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { textRoles } from '../../../shared/theme/typography';
import { colors } from '../../../shared/theme/colors';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  onChange: (index: number) => void;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export function SubstituteExerciseSheet({
  sheetRef,
  onChange,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['40%'], []);
  const [nameInput, setNameInput] = useState('');

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const handleSheetChange = useCallback(
    (index: number) => {
      onChange(index);
      if (index < 0) {
        setNameInput('');
      }
    },
    [onChange],
  );

  const handleDismiss = useCallback(() => {
    setNameInput('');
    onClose();
  }, [onClose]);

  const trimmedName = nameInput.trim();
  const canConfirm = trimmedName.length > 0;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm(trimmedName);
  }, [canConfirm, onConfirm, trimmedName]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableHandlePanningGesture={false}
      enableContentPanningGesture={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      bottomInset={insets.bottom}
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
      onDismiss={handleDismiss}
      backgroundStyle={{ backgroundColor: colors['surface-1'] }}
      handleIndicatorStyle={{ backgroundColor: colors['text-disabled'] }}
    >
      <BottomSheetView className="px-6 pb-8 pt-2">
        <Text
          className={`text-text-primary ${textRoles.modalTitle} mb-4`}
          accessibilityRole="header"
        >
          Substitute exercise
        </Text>

        <Text className={`text-text-secondary ${textRoles.fieldLabel} mb-1`}>EXERCISE NAME</Text>
        <BottomSheetTextInput
          className={`bg-surface-2 rounded-lg px-4 py-3 text-text-primary ${textRoles.body} mb-5`}
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="e.g. Incline DB Press"
          placeholderTextColor={colors['text-disabled']}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
          accessibilityLabel="Substitute exercise name"
        />

        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-surface-2 rounded-lg py-4 items-center"
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityLabel="Cancel substitute"
            activeOpacity={0.7}
          >
            <Text className={`text-text-primary ${textRoles.buttonLabel}`}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 bg-accent rounded-lg py-4 items-center ${!canConfirm ? 'opacity-40' : ''}`}
            onPress={handleConfirm}
            disabled={!canConfirm}
            accessibilityLabel="Confirm substitute"
            activeOpacity={0.7}
          >
            <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
