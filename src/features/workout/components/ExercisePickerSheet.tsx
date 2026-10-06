import React, { useCallback, useMemo, useState, type RefObject } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
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
import { colors } from '../../../shared/theme/colors';
import { textRoles, typography } from '../../../shared/theme/typography';
import { useSplitsStore } from '../../splits';
import type { Exercise } from '../../splits/types';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  title: string;
  searchPlaceholder?: string;
  /** Shown when the library is empty and nothing has been typed. */
  emptyHint?: string;
  /** Verb used on the per-row action label, e.g. "Add" / "Substitute with". */
  selectVerb?: string;
  /**
   * Hidden from the list. Substituting an exercise with itself would clear
   * the sets already logged against it and put the same exercise back.
   */
  excludeExerciseId?: string;
  /** Resolves with a real library exercise — created on the spot if new. */
  onSelect: (exercise: Exercise) => void;
  onChange?: (index: number) => void;
  onClose?: () => void;
}

/**
 * Pick an exercise from the master library, or create one on the spot.
 *
 * Shared by "add an exercise to this session" and "substitute this
 * exercise": both are the same question, and substitution used to ask it
 * with a bare text box instead — which meant the chosen exercise had no
 * library row behind it, so it could never be opened from Trends or
 * accumulate history across sessions.
 */
export function ExercisePickerSheet({
  sheetRef,
  title,
  searchPlaceholder = 'Search or add new...',
  emptyHint = 'No exercises in your library yet. Type a name to create one.',
  selectVerb = 'Add',
  excludeExerciseId,
  onSelect,
  onChange,
  onClose,
}: Props) {
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

  const handleDismiss = useCallback(() => {
    setQuery('');
    onClose?.();
  }, [onClose]);

  const trimmed = query.trim();
  const selectable = useMemo(
    () => (excludeExerciseId ? library.filter((ex) => ex.id !== excludeExerciseId) : library),
    [excludeExerciseId, library],
  );
  const matches = useMemo(() => {
    if (!trimmed) return selectable;
    const needle = trimmed.toLowerCase();
    return selectable.filter((ex) => ex.name.toLowerCase().includes(needle));
  }, [selectable, trimmed]);

  const exactMatch = useMemo(
    () => selectable.find((ex) => ex.name.toLowerCase() === trimmed.toLowerCase()) ?? null,
    [selectable, trimmed],
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
      onDismiss={handleDismiss}
      backgroundStyle={{ backgroundColor: '#141414' }}
      handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
    >
      {/* Inline padding: the sheet → gesture-handler → react-native-web
          chain drops NativeWind classes, which ran this content off both
          edges on the PWA. */}
      <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 8, flex: 1 }}>
        <Text
          className={`text-text-primary ${textRoles.modalTitle} mb-3`}
          style={webText(typography.fonts.sansBold, typography.sizes.lg, colors['text-primary'])}
          accessibilityRole="header"
        >
          {title}
        </Text>

        <BottomSheetTextInput
          className="bg-surface-2 rounded-lg px-4 py-3 text-text-primary font-sans text-base mb-3"
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor="#8A8580"
          // Native only. Focusing an input inside a sheet on web sends
          // @gorhom/bottom-sheet through a keyboard path that calls
          // TextInputState.currentlyFocusedInput(), which react-native-web
          // does not implement — it threw on every open. Tapping the field
          // still works, and it is the first thing in the sheet.
          autoFocus={Platform.OS !== 'web'}
          returnKeyType="done"
          onSubmitEditing={() => void handleCreate()}
          accessibilityLabel={searchPlaceholder}
          style={webInput()}
        />

        {/* Create-new row appears whenever the trimmed query doesn't exactly
            match an existing library exercise. */}
        {canCreate ? (
          <TouchableOpacity
            className="flex-row items-center gap-3 bg-accent/[0.12] border border-accent/40 rounded-lg px-4 py-3 mb-3"
            onPress={() => void handleCreate()}
            accessibilityRole="button"
            accessibilityLabel={`Create new exercise ${trimmed}`}
            activeOpacity={0.7}
          >
            <Icon name="plus-circle" size={20} color="accent" />
            <View className="flex-1">
              <Text
                className={`text-text-primary ${textRoles.body}`}
                style={webText(typography.fonts.sans, typography.sizes.base, colors['text-primary'])}
              >
                Create &quot;{trimmed}&quot;
              </Text>
              <Text
                className={`text-text-secondary ${textRoles.caption} mt-0.5`}
                style={webText(typography.fonts.sans, typography.sizes.xs, colors['text-secondary'])}
              >
                Adds to your exercise library
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <BottomSheetFlatList
          data={matches}
          keyExtractor={(item: Exercise) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            trimmed.length > 0 ? null : (
              <Text
                className={`text-text-secondary ${textRoles.bodySmall} text-center mt-6`}
                style={webText(typography.fonts.sans, typography.sizes.sm, colors['text-secondary'])}
              >
                {emptyHint}
              </Text>
            )
          }
          renderItem={({ item }: { item: Exercise }) => (
            <TouchableOpacity
              className="flex-row items-center justify-between bg-surface-1 rounded-lg px-4 py-3 mb-2"
              onPress={() => handlePickExisting(item)}
              accessibilityRole="button"
              accessibilityLabel={`${selectVerb} ${item.name}`}
              activeOpacity={0.7}
            >
              <View className="flex-1 pr-3">
                <Text
                  className={`text-text-primary ${textRoles.body}`}
                  style={webText(typography.fonts.sans, typography.sizes.base, colors['text-primary'])}
                >
                  {item.name}
                </Text>
                {(item.unilateral || item.plateLoaded) && (
                  <Text
                    className={`text-text-secondary ${textRoles.caption} mt-0.5`}
                    style={webText(typography.fonts.sans, typography.sizes.xs, colors['text-secondary'])}
                  >
                    {[item.unilateral ? 'Unilateral' : null, item.plateLoaded ? 'Plate-loaded' : null]
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

/** See the note on BottomSheetView above — same rescue as SignInSheet. */
function webText(fontFamily: string, fontSize: number, color: string) {
  return Platform.OS === 'web' ? { fontFamily, fontSize, color } : undefined;
}

function webInput() {
  return Platform.OS === 'web'
    ? {
        backgroundColor: colors['surface-2'],
        borderRadius: 8,
        borderWidth: 0,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: colors['text-primary'],
        fontFamily: typography.fonts.sans,
        fontSize: typography.sizes.base,
        width: '100%' as const,
      }
    : undefined;
}
