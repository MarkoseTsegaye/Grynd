import React, { useCallback, useMemo, useState, type RefObject } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import { useSplitsStore } from '../../splits';
import type { Exercise } from '../../splits/types';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  /**
   * Called with the picked/created exercise. The caller is responsible for
   * wiring this into the workout store (`addAdHocExercise({masterExerciseId,
   * name, unilateral, plateLoaded})`). This sheet does not know or care
   * whether the exercise ends up in the current session.
   */
  onSelect: (exercise: Exercise) => void;
  onChange?: (index: number) => void;
}

/**
 * Pick an existing exercise from the master library OR create a brand-new
 * one. Selection resolves via `onSelect(exercise)`; the caller then wires it
 * into the active workout via `useWorkoutStore.addAdHocExercise`.
 *
 * Deliberately does NOT append the exercise to the current split — the
 * feature is one-off addition to the live session.
 */
export function AddExerciseSheet({ sheetRef, onSelect, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['70%'], []);
  const library = useSplitsStore((s) => s.exercises);
  const createExercise = useSplitsStore((s) => s.createExercise);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const handleSheetChange = useCallback(
    (index: number) => {
      onChange?.(index);
      if (index < 0) setQuery('');
    },
    [onChange],
  );

  const trimmed = query.trim();
  const matches = useMemo(() => {
    if (!trimmed) return library;
    const needle = trimmed.toLowerCase();
    return library.filter((ex) => ex.name.toLowerCase().includes(needle));
  }, [library, trimmed]);

  const exactMatch = useMemo(
    () => library.find((ex) => ex.name.toLowerCase() === trimmed.toLowerCase()) ?? null,
    [library, trimmed],
  );

  const canCreate = trimmed.length > 0 && !exactMatch && !creating;

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const created = await createExercise(trimmed);
      onSelect(created);
      sheetRef.current?.dismiss();
    } finally {
      setCreating(false);
    }
  }, [canCreate, createExercise, onSelect, sheetRef, trimmed]);

  const handlePickExisting = useCallback(
    (exercise: Exercise) => {
      onSelect(exercise);
      sheetRef.current?.dismiss();
    },
    [onSelect, sheetRef],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      bottomInset={insets.bottom}
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
      backgroundStyle={{ backgroundColor: '#141414' }}
      handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
    >
      <BottomSheetView className="px-5 pt-2 flex-1">
        <Text
          className={`text-text-primary ${textRoles.modalTitle} mb-3`}
          accessibilityRole="header"
        >
          Add exercise
        </Text>

        <BottomSheetTextInput
          className="bg-surface-2 rounded-lg px-4 py-3 text-text-primary font-sans text-base mb-3"
          value={query}
          onChangeText={setQuery}
          placeholder="Search or add new..."
          placeholderTextColor="#8A8580"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
          accessibilityLabel="Search or create exercise"
        />

        {/* Create-new row appears whenever the trimmed query doesn't exactly
            match an existing library exercise. */}
        {canCreate ? (
          <TouchableOpacity
            className="flex-row items-center gap-3 bg-accent/[0.12] border border-accent/40 rounded-lg px-4 py-3 mb-3"
            onPress={handleCreate}
            accessibilityRole="button"
            accessibilityLabel={`Create new exercise ${trimmed}`}
            activeOpacity={0.7}
          >
            <Icon name="plus-circle" size={20} color="accent" />
            <View className="flex-1">
              <Text className={`text-text-primary ${textRoles.body}`}>
                Create &quot;{trimmed}&quot;
              </Text>
              <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
                Adds to your exercise library
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <BottomSheetFlatList
          data={matches}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            trimmed.length > 0 ? null : (
              <Text
                className={`text-text-secondary ${textRoles.bodySmall} text-center mt-6`}
              >
                No exercises in your library yet. Type a name to create one.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className="flex-row items-center justify-between bg-surface-1 rounded-lg px-4 py-3 mb-2"
              onPress={() => handlePickExisting(item)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name}`}
              activeOpacity={0.7}
            >
              <View className="flex-1 pr-3">
                <Text className={`text-text-primary ${textRoles.body}`}>{item.name}</Text>
                {(item.unilateral || item.plateLoaded) && (
                  <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
                    {[
                      item.unilateral ? 'Unilateral' : null,
                      item.plateLoaded ? 'Plate-loaded' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
              </View>
              <Icon name="plus" size={20} color="text-secondary" />
            </TouchableOpacity>
          )}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
