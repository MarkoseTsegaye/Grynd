import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { NumericInput } from '../../../shared/components/NumericInput';
import { Icon } from '../../../shared/components/Icon';
import { WorkoutDatePicker } from '../../workout/components/WorkoutDatePicker';
import {
  dateKeyToday,
  formatDisplayDate,
  parseDateKey,
  toDateKey,
} from '../../../shared/lib/date';
import { textRoles, typography } from '../../../shared/theme/typography';
import { colors } from '../../../shared/theme/colors';
import type { WeightEntry } from '../types';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  /** Pre-populated when editing (or backfilling a specific day). */
  entry: WeightEntry | null;
  /** Called when the sheet content should be reset (dismiss without saving). */
  onDismiss?: () => void;
  onSubmit: (input: {
    dateKey: string;
    weightLbs: number;
    calories: number | null;
  }) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

const MAX_WEIGHT_LBS = 1000;
const MAX_CALORIES = 20_000;

function parseWeight(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  if (value <= 0 || value > MAX_WEIGHT_LBS) return null;
  return Math.round(value * 10) / 10;
}

function parseCalories(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  if (value < 0 || value > MAX_CALORIES) return null;
  return Math.round(value);
}

export function LogWeightSheet({ sheetRef, entry, onDismiss, onSubmit, onDelete }: Props) {
  const weightRef = useRef<TextInput>(null);
  const caloriesRef = useRef<TextInput>(null);
  const [date, setDate] = useState<Date>(() => new Date());
  const [weightInput, setWeightInput] = useState('');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const snapPoints = useMemo(() => [Platform.OS === 'web' ? '95%' : '82%'], []);

  // Reset local state to reflect the currently-editing entry (or a fresh
  // "today" entry when null). Keyed off id so it also re-runs when the caller
  // swaps from editing entry A to editing entry B.
  useEffect(() => {
    if (entry) {
      const parsed = parseDateKey(entry.dateKey) ?? new Date(entry.loggedAt);
      setDate(parsed);
      setWeightInput(String(entry.weightLbs));
      setCaloriesInput(entry.calories !== undefined ? String(entry.calories) : '');
    } else {
      setDate(new Date());
      setWeightInput('');
      setCaloriesInput('');
    }
    setDatePickerOpen(false);
  }, [entry?.id, entry]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const weightValue = parseWeight(weightInput);
  const canSubmit = weightValue !== null && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || weightValue === null) return;
    setSubmitting(true);
    try {
      const dateKey = toDateKey(date);
      const cal = parseCalories(caloriesInput);
      // Empty string during edit → clear the field (null); missing on create → undefined.
      const calories = caloriesInput.trim() === '' ? (entry ? null : null) : cal;
      await onSubmit({ dateKey, weightLbs: weightValue, calories });
      sheetRef.current?.dismiss();
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, caloriesInput, date, entry, onSubmit, sheetRef, weightValue]);

  const handleDelete = useCallback(async () => {
    if (!entry || !onDelete) return;
    setSubmitting(true);
    try {
      await onDelete(entry.id);
      sheetRef.current?.dismiss();
    } finally {
      setSubmitting(false);
    }
  }, [entry, onDelete, sheetRef]);

  const isToday = toDateKey(date) === dateKeyToday();
  const isEditing = entry !== null;

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
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: '#141414' }}
      handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        {/* Web: close X — same reason as LogSheet (pan gestures are disabled). */}
        {Platform.OS === 'web' ? (
          <View className="flex-row justify-end pt-1 -mr-1">
            <TouchableOpacity
              onPress={() => sheetRef.current?.dismiss()}
              accessibilityLabel="Close weight log"
              accessibilityRole="button"
              activeOpacity={0.7}
              hitSlop={12}
              className="p-2"
            >
              <Icon name="close" size={24} color="text-secondary" />
            </TouchableOpacity>
          </View>
        ) : null}

        <Text
          className={`text-text-primary ${textRoles.modalTitle} mb-4 mt-2`}
          accessibilityRole="header"
        >
          {isEditing ? 'Edit Weight' : 'Log Weight'}
        </Text>

        {/* Date row — tap to expand a wheel picker for backfill. */}
        <TouchableOpacity
          className="bg-surface-2 rounded-lg px-4 py-3 mb-4 flex-row items-center justify-between"
          onPress={() => setDatePickerOpen((open) => !open)}
          accessibilityLabel="Change date"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <View>
            <Text className={`text-text-secondary ${textRoles.caption}`}>Date</Text>
            <Text className={`text-text-primary ${textRoles.body} mt-0.5`}>
              {isToday ? `Today · ${formatDisplayDate(date)}` : formatDisplayDate(date)}
            </Text>
          </View>
          <Icon name={datePickerOpen ? 'chevron-up' : 'chevron-down'} size={22} color="text-secondary" />
        </TouchableOpacity>

        {datePickerOpen ? (
          <View className="mb-4">
            <WorkoutDatePicker value={date} onChange={setDate} />
          </View>
        ) : null}

        {/* Weight input */}
        <View className="mb-4">
          <Text className={`text-text-secondary ${textRoles.bodySmall} mb-1`}>WEIGHT</Text>
          <NumericInput
            ref={weightRef}
            InputComponent={BottomSheetTextInput}
            value={weightInput}
            onChangeText={setWeightInput}
            suffix="lb"
            integerOnly={false}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => caloriesRef.current?.focus()}
            maxLength={6}
            accessibilityLabel="Body weight in pounds"
          />
        </View>

        {/* Calories input (optional) */}
        <View className="mb-6">
          <Text className={`text-text-secondary ${textRoles.bodySmall} mb-1`}>
            CALORIES <Text className={`text-text-disabled ${textRoles.caption}`}>(optional)</Text>
          </Text>
          <NumericInput
            ref={caloriesRef}
            InputComponent={BottomSheetTextInput}
            value={caloriesInput}
            onChangeText={setCaloriesInput}
            suffix="kcal"
            integerOnly
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            maxLength={5}
            accessibilityLabel="Daily calorie intake"
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          className={`bg-accent rounded-lg py-4 items-center ${!canSubmit ? 'opacity-40' : ''}`}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityLabel={isEditing ? 'Save weight entry' : 'Log weight entry'}
          activeOpacity={0.7}
        >
          <Text
            className={`text-surface-0 ${textRoles.buttonLabel}`}
            style={
              Platform.OS === 'web'
                ? {
                    // Same web-only inline style rescue as NumericInput —
                    // BottomSheetTextInput chain drops className styles.
                    color: colors['surface-0'],
                    fontFamily: typography.fonts.sansBold,
                    fontSize: typography.sizes.base,
                  }
                : undefined
            }
          >
            {isEditing ? 'Save' : 'Log weight'}
          </Text>
        </TouchableOpacity>

        {/* Delete row — only for editing an existing entry */}
        {isEditing && onDelete ? (
          <TouchableOpacity
            className="mt-4 flex-row items-center justify-center gap-2 py-3"
            onPress={handleDelete}
            disabled={submitting}
            accessibilityLabel="Delete entry"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Icon name="trash-can-outline" size={20} color="danger" />
            <Text className={`text-danger ${textRoles.buttonLabelSmall}`}>Delete entry</Text>
          </TouchableOpacity>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
