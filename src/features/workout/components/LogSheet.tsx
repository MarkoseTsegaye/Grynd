import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import type { RefObject } from 'react';
import { View, Text, TouchableOpacity, TextInput, Keyboard, Platform } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps, BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NumericInput } from '../../../shared/components/NumericInput';
import { Icon } from '../../../shared/components/Icon';
import { formatPlatesPerSide } from '../../../shared/lib/weight';
import { textRoles } from '../../../shared/theme/typography';
import { colors } from '../../../shared/theme/colors';

const MAX_SET_NOTES_LENGTH = 200;
const NOTES_MIN_HEIGHT = 48;

type LogField = 'weight' | 'reps' | 'rpe' | 'notes';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  onChange: (index: number) => void;
  // Reps
  repInput: string;
  onChangeReps: (val: string) => void;
  // Weight mode
  weightMode: 'straight' | 'plates';
  onToggleWeightMode: () => void;
  // Unit
  weightUnit: 'kg' | 'lbs';
  onToggleUnit: () => void;
  // Straight weight
  weightInput: string;
  onChangeWeight: (val: string) => void;
  // Plates
  plates: Record<number, number>;
  plateList: number[];
  onAddPlate: (weight: number) => void;
  onRemovePlate: (weight: number) => void;
  computedWeightKg: number;
  // Effort
  toFailure: boolean;
  onToggleFailure: () => void;
  rpeInput: string;
  onChangeRpe: (val: string) => void;
  notesInput: string;
  onChangeNotes: (val: string) => void;
  // Control
  isLogging: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function LogSheet({
  sheetRef,
  onChange,
  repInput, onChangeReps,
  weightMode, onToggleWeightMode,
  weightUnit, onToggleUnit,
  weightInput, onChangeWeight,
  plates, plateList, onAddPlate, onRemovePlate, computedWeightKg,
  toFailure, onToggleFailure,
  rpeInput, onChangeRpe,
  notesInput, onChangeNotes,
  isLogging, onConfirm, onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const repsRef = useRef<TextInput>(null);
  const weightRef = useRef<TextInput>(null);
  const rpeRef = useRef<TextInput>(null);
  const fieldOffsets = useRef<Record<LogField, number>>({ weight: 0, reps: 0, rpe: 0, notes: 0 });
  const effortSectionY = useRef(0);
  const confirmOffset = useRef(0);
  const notesContentHeight = useRef(NOTES_MIN_HEIGHT);
  const [notesInputHeight, setNotesInputHeight] = useState(NOTES_MIN_HEIGHT);
  const [focusedField, setFocusedField] = useState<LogField | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const snapPoints = useMemo(() => ['82%'], []);

  const contentPaddingBottom = useMemo(() => {
    const base = Math.max(insets.bottom, 40);
    if (keyboardHeight > 0 && focusedField !== null) {
      return base + Math.max(24, keyboardHeight * 0.25);
    }
    return base;
  }, [focusedField, insets.bottom, keyboardHeight]);

  const scrollRepsIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      const fieldY = fieldOffsets.current.reps ?? 0;
      const confirmY = confirmOffset.current;
      const fieldScroll = Math.max(0, fieldY - 12);

      if (confirmY <= 0) {
        scrollRef.current?.scrollTo({ y: fieldScroll, animated: true });
        return;
      }

      const visibleEstimate = Math.max(180, keyboardHeight > 0 ? keyboardHeight * 0.55 : 220);
      const confirmScroll = Math.max(0, confirmY - visibleEstimate);
      const targetY = Math.min(fieldScroll, confirmScroll);

      scrollRef.current?.scrollTo({ y: targetY, animated: true });
    });
  }, [keyboardHeight]);

  const scrollNotesIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      const fieldY = fieldOffsets.current.notes ?? 0;
      const confirmY = confirmOffset.current;
      const fieldScroll = Math.max(0, fieldY - 12);
      const notesBottomY = fieldY + notesContentHeight.current;
      const visibleEstimate = Math.max(200, keyboardHeight > 0 ? keyboardHeight * 0.5 : 240);
      const notesScroll = Math.max(0, notesBottomY - visibleEstimate + 16);
      const confirmScroll = confirmY > 0 ? Math.max(0, confirmY - visibleEstimate) : 0;
      const targetY = Math.max(fieldScroll, notesScroll, confirmScroll);

      scrollRef.current?.scrollTo({ y: targetY, animated: true });
    });
  }, [keyboardHeight]);

  const scrollFieldIntoView = useCallback((field: LogField) => {
    if (field === 'reps') {
      scrollRepsIntoView();
      return;
    }
    if (field === 'notes') {
      scrollNotesIntoView();
      return;
    }

    requestAnimationFrame(() => {
      const fieldY = fieldOffsets.current[field] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, fieldY - 12), animated: true });
    });
  }, [scrollNotesIntoView, scrollRepsIntoView]);

  const handleFieldFocus = useCallback(
    (field: LogField) => {
      setFocusedField(field);
      scrollFieldIntoView(field);
    },
    [scrollFieldIntoView],
  );

  const handleFieldBlur = useCallback(() => {
    setFocusedField(null);
  }, []);

  const handleKeyboardHide = useCallback(() => {
    setFocusedField(null);
    setKeyboardHeight(0);
  }, []);

  const resetSheetScrollState = useCallback(() => {
    setFocusedField(null);
    setKeyboardHeight(0);
    setNotesInputHeight(NOTES_MIN_HEIGHT);
    notesContentHeight.current = NOTES_MIN_HEIGHT;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const handleNotesContentSizeChange = useCallback(
    (height: number) => {
      const nextHeight = Math.max(NOTES_MIN_HEIGHT, height);
      notesContentHeight.current = nextHeight;
      setNotesInputHeight(nextHeight);
      if (focusedField === 'notes') {
        scrollNotesIntoView();
      }
    },
    [focusedField, scrollNotesIntoView],
  );

  useEffect(() => {
    if (!sheetOpen) {
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [sheetOpen, handleKeyboardHide]);

  useEffect(() => {
    if (!sheetOpen || keyboardHeight === 0 || focusedField !== 'reps') {
      return;
    }

    const timer = setTimeout(() => scrollRepsIntoView(), 100);
    return () => clearTimeout(timer);
  }, [sheetOpen, keyboardHeight, focusedField, scrollRepsIntoView]);

  useEffect(() => {
    if (!sheetOpen || keyboardHeight === 0 || focusedField !== 'notes') {
      return;
    }

    const timer = setTimeout(() => scrollNotesIntoView(), 100);
    return () => clearTimeout(timer);
  }, [sheetOpen, keyboardHeight, focusedField, notesInput, scrollNotesIntoView]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const handleSheetChange = useCallback(
    (index: number) => {
      const isOpen = index >= 0;
      setSheetOpen(isOpen);
      onChange(index);
      if (!isOpen) {
        resetSheetScrollState();
      }
    },
    [onChange, resetSheetScrollState],
  );

  const reps = parseInt(repInput, 10);

  const plateSummary = Object.entries(plates)
    .map(([w, c]) => ({ weight: Number(w), count: c }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.weight - a.weight);

  const weightValid =
    weightMode === 'plates' ? plateSummary.length > 0 : computedWeightKg > 0;
  const canConfirm = !isLogging && !isNaN(reps) && reps > 0 && weightValid;

  const platesDisplay = plateSummary.length > 0 ? formatPlatesPerSide(plates) : '0';

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableHandlePanningGesture={false}
      enableContentPanningGesture={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      bottomInset={0}
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: colors['surface-1'] }}
      handleIndicatorStyle={{ backgroundColor: colors['text-disabled'] }}
    >
      <BottomSheetScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: contentPaddingBottom }}
      >
        {/* Mode toggle */}
        <View className="flex-row gap-2 mb-5 mt-2">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg items-center ${weightMode === 'straight' ? 'bg-accent' : 'bg-surface-2'}`}
            onPress={() => weightMode !== 'straight' && onToggleWeightMode()}
            accessibilityLabel="Straight weight mode"
            activeOpacity={0.7}
          >
            <Text className={`${textRoles.toggleLabel} ${weightMode === 'straight' ? 'text-surface-0' : 'text-text-secondary'}`}>
              {weightUnit === 'kg' ? 'kg' : 'lbs'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg items-center ${weightMode === 'plates' ? 'bg-accent' : 'bg-surface-2'}`}
            onPress={() => weightMode !== 'plates' && onToggleWeightMode()}
            accessibilityLabel="Plate loading mode"
            activeOpacity={0.7}
          >
            <Text className={`${textRoles.toggleLabel} ${weightMode === 'plates' ? 'text-surface-0' : 'text-text-secondary'}`}>
              Plates
            </Text>
          </TouchableOpacity>
        </View>

        {/* Weight + Reps */}
        <View
          className="mb-1"
          onLayout={(event) => {
            const y = event.nativeEvent.layout.y;
            fieldOffsets.current.weight = y;
            fieldOffsets.current.reps = y;
          }}
        >
          <View className="flex-row gap-4">
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className={`text-text-secondary ${textRoles.fieldLabel}`}>WEIGHT</Text>
              {weightMode === 'straight' && (
                <View className="flex-row gap-1">
                  <TouchableOpacity
                    className={`px-2 py-0.5 rounded ${weightUnit === 'kg' ? 'bg-accent' : 'bg-surface-2'}`}
                    onPress={() => weightUnit !== 'kg' && onToggleUnit()}
                    accessibilityLabel="Use kilograms"
                    activeOpacity={0.7}
                  >
                    <Text className={`${textRoles.toggleLabel} ${weightUnit === 'kg' ? 'text-surface-0' : 'text-text-secondary'}`}>kg</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`px-2 py-0.5 rounded ${weightUnit === 'lbs' ? 'bg-accent' : 'bg-surface-2'}`}
                    onPress={() => weightUnit !== 'lbs' && onToggleUnit()}
                    accessibilityLabel="Use pounds"
                    activeOpacity={0.7}
                  >
                    <Text className={`${textRoles.toggleLabel} ${weightUnit === 'lbs' ? 'text-surface-0' : 'text-text-secondary'}`}>lbs</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {weightMode === 'straight' ? (
              <NumericInput
                ref={weightRef}
                InputComponent={BottomSheetTextInput}
                value={weightInput}
                onChangeText={onChangeWeight}
                suffix={weightUnit}
                keyboardType="number-pad"
                returnKeyType="next"
                onSubmitEditing={() => repsRef.current?.focus()}
                onFocus={() => handleFieldFocus('weight')}
                onBlur={handleFieldBlur}
                accessibilityLabel="Weight input"
              />
            ) : (
              <View className="bg-surface-2 rounded-lg px-4 py-4 items-center justify-center min-h-16">
                <Text className={`text-text-primary ${textRoles.metricDisplayCompact}`} numberOfLines={2} adjustsFontSizeToFit>
                  {platesDisplay}
                </Text>
                <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>one side</Text>
              </View>
            )}
          </View>
          <View className="flex-1">
            <Text className={`text-text-secondary ${textRoles.fieldLabel} mb-1`}>REPS</Text>
            <NumericInput
              ref={repsRef}
              InputComponent={BottomSheetTextInput}
              value={repInput}
              onChangeText={onChangeReps}
              suffix="reps"
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={onConfirm}
              onFocus={() => handleFieldFocus('reps')}
              onBlur={handleFieldBlur}
              maxLength={3}
              accessibilityLabel="Reps input"
            />
          </View>
          </View>
        </View>

        {/* Plates UI */}
        {weightMode === 'plates' && (
          <View className="mt-4 mb-2">
            <View className="flex-row gap-1 mb-3">
              <TouchableOpacity
                className={`px-3 py-1 rounded ${weightUnit === 'kg' ? 'bg-accent' : 'bg-surface-2'}`}
                onPress={() => weightUnit !== 'kg' && onToggleUnit()}
                accessibilityLabel="Use kg plates"
                activeOpacity={0.7}
              >
                <Text className={`${textRoles.toggleLabel} ${weightUnit === 'kg' ? 'text-surface-0' : 'text-text-secondary'}`}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-1 rounded ${weightUnit === 'lbs' ? 'bg-accent' : 'bg-surface-2'}`}
                onPress={() => weightUnit !== 'lbs' && onToggleUnit()}
                accessibilityLabel="Use lbs plates"
                activeOpacity={0.7}
              >
                <Text className={`${textRoles.toggleLabel} ${weightUnit === 'lbs' ? 'text-surface-0' : 'text-text-secondary'}`}>lbs</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {plateList.map((weight) => (
                <TouchableOpacity
                  key={weight}
                  className="bg-surface-2 rounded-lg px-4 py-3 items-center"
                  onPress={() => onAddPlate(weight)}
                  accessibilityLabel={`Add ${weight} ${weightUnit} plate`}
                  activeOpacity={0.7}
                >
                  <Text className={`text-text-primary ${textRoles.metricBody}`}>{weight}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {plateSummary.length > 0 && (
              <View className="bg-surface-0 rounded-lg px-4 py-3 mb-1">
                <Text className={`text-text-secondary ${textRoles.caption} mb-2`}>One side:</Text>
                <View className="flex-row flex-wrap gap-2">
                  {plateSummary.map(({ weight, count }) => (
                    <View key={weight} className="flex-row items-center gap-1 bg-surface-2 rounded px-2 py-1">
                      <Text className={`text-text-primary ${textRoles.metric}`}>{weight} × {count}</Text>
                      <TouchableOpacity
                        onPress={() => onRemovePlate(weight)}
                        accessibilityLabel={`Remove ${weight} plate`}
                        activeOpacity={0.7}
                      >
                        <Icon name="minus-circle-outline" size={16} color="text-secondary" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Effort section */}
        <View
          className="border-t border-surface-2 mt-4 pt-4 mb-5"
          onLayout={(event) => {
            effortSectionY.current = event.nativeEvent.layout.y;
            fieldOffsets.current.rpe = event.nativeEvent.layout.y;
          }}
        >
          <Text className={`text-text-secondary ${textRoles.fieldLabel} mb-3`}>Effort (optional)</Text>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              className="flex-row items-center gap-2"
              onPress={onToggleFailure}
              accessibilityLabel={toFailure ? 'Remove failure tag' : 'Tag as to failure'}
              activeOpacity={0.7}
            >
              <Icon name="fire" size={20} color={toFailure ? 'danger' : 'text-disabled'} />
              <Text className={`${textRoles.bodySmall} ${toFailure ? 'text-danger' : 'text-text-disabled'}`}>
                {toFailure ? 'Failed' : 'To Failure'}
              </Text>
            </TouchableOpacity>
            <View className="flex-row items-center gap-2">
              <Text className={`text-text-secondary ${textRoles.bodySmall}`}>RPE</Text>
              <View className="w-14">
                <NumericInput
                  ref={rpeRef}
                  size="compact"
                  InputComponent={BottomSheetTextInput}
                  value={rpeInput}
                  integerOnly={false}
                  onChangeText={(v) => {
                    const num = parseInt(v, 10);
                    if (v === '') { onChangeRpe(''); return; }
                    if (!isNaN(num)) onChangeRpe(String(Math.min(10, Math.max(1, num))));
                  }}
                  placeholder="—"
                  keyboardType="number-pad"
                  maxLength={2}
                  onFocus={() => handleFieldFocus('rpe')}
                  onBlur={handleFieldBlur}
                  accessibilityLabel="RPE input"
                />
              </View>
              <Text className={`text-text-secondary ${textRoles.bodySmall}`}>/ 10</Text>
            </View>
          </View>
          <View
            className="mt-3"
            onLayout={(event) => {
              fieldOffsets.current.notes = effortSectionY.current + event.nativeEvent.layout.y;
            }}
          >
            <Text className={`text-text-secondary ${textRoles.fieldLabel} mb-1`}>Notes (optional)</Text>
            <BottomSheetTextInput
              className={`bg-surface-2 rounded-lg px-4 py-3 text-text-primary ${textRoles.body}`}
              style={{ minHeight: NOTES_MIN_HEIGHT, height: notesInputHeight }}
              value={notesInput}
              onChangeText={onChangeNotes}
              placeholder="e.g. used straps, paused mid-set"
              placeholderTextColor={colors['text-secondary']}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              maxLength={MAX_SET_NOTES_LENGTH}
              onContentSizeChange={(event) => {
                handleNotesContentSizeChange(event.nativeEvent.contentSize.height);
              }}
              onFocus={() => handleFieldFocus('notes')}
              onBlur={handleFieldBlur}
              accessibilityLabel="Set notes input"
            />
          </View>
        </View>

        {/* Confirm button */}
        <View
          onLayout={(event) => {
            confirmOffset.current = event.nativeEvent.layout.y;
          }}
        >
          <TouchableOpacity
            className={`bg-accent rounded-lg py-4 items-center ${!canConfirm ? 'opacity-40' : ''}`}
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityLabel="Log set"
            activeOpacity={0.7}
          >
            <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>Log Set</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
