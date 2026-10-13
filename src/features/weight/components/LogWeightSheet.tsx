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
import { Button } from '../../../shared/components/Button';
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
import { usePrefsStore } from '../../../shared/store/prefsStore';
import {
  bodyWeightToDisplay,
  displayToLbs,
  maxBodyWeightInUnit,
  unitLabel,
  type WeightUnit,
} from '../lib/weightUnits';
import type { WeightEntry } from '../types';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  /** Pre-populated when editing (or backfilling a specific day). */
  entry: WeightEntry | null;
  /** Called when the sheet content should be reset (dismiss without saving). */
  onDismiss?: () => void;
  onSubmit: (input: { dateKey: string; weightLbs: number }) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

/**
 * Parses what the user typed, in the unit they're typing in. The result
 * is a DISPLAY value — the caller converts to stored pounds. Keeping the
 * conversion out of here means the bounds check happens against a
 * ceiling expressed in the same unit as the input.
 */
function parseWeight(input: string, unit: WeightUnit): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  if (value <= 0 || value > maxBodyWeightInUnit(unit)) return null;
  return Math.round(value * 10) / 10;
}

export function LogWeightSheet({ sheetRef, entry, onDismiss, onSubmit, onDelete }: Props) {
  const weightUnit = usePrefsStore((s) => s.weightUnit);
  const weightRef = useRef<TextInput>(null);
  const [date, setDate] = useState<Date>(() => new Date());
  const [weightInput, setWeightInput] = useState('');
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
      // Seed the field in the unit the user types in, not the stored one.
      setWeightInput(String(bodyWeightToDisplay(entry.weightLbs, weightUnit)));
    } else {
      setDate(new Date());
      setWeightInput('');
    }
    setDatePickerOpen(false);
  }, [entry?.id, entry, weightUnit]);

  /**
   * Open with the cursor already in the weight field — the number is the
   * only reason this sheet exists.
   *
   * Native only, and deliberately not `autoFocus`. Focusing this input
   * programmatically sends @gorhom/bottom-sheet down a keyboard path that
   * calls `TextInputState.currentlyFocusedInput()`, which react-native-web
   * does not implement; it threw on every open of the sheet. Tapping the
   * field still focuses it fine on web, and the field is now the first
   * thing in the sheet, so the cost there is one tap.
   */
  const handleSheetChange = useCallback((index: number) => {
    if (index < 0 || Platform.OS === 'web') return;
    setTimeout(() => weightRef.current?.focus(), 120);
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const weightValue = parseWeight(weightInput, weightUnit);
  const canSubmit = weightValue !== null && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || weightValue === null) return;
    setSubmitting(true);
    try {
      const dateKey = toDateKey(date);
      // `weightValue` is in the user's display unit; the store is
      // lb-canonical. Skipping this conversion is what would make a kg
      // user's "82" land as 82 lb.
      await onSubmit({ dateKey, weightLbs: displayToLbs(weightValue, weightUnit) });
      sheetRef.current?.dismiss();
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, date, onSubmit, sheetRef, weightUnit, weightValue]);

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
      onChange={handleSheetChange}
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: '#141414' }}
      handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        {/* Title and close. The X is no longer web-only: pan-to-close is
            disabled on every platform here (the wheel picker needs the
            vertical gesture), so without it native had no way out but the
            backdrop. */}
        <View className="flex-row items-center justify-between pt-1 -mr-1 mb-5">
          <Text
            className={`text-text-primary ${textRoles.modalTitle}`}
            style={
              Platform.OS === 'web'
                ? {
                    color: colors['text-primary'],
                    fontFamily: typography.fonts.sansBold,
                    fontSize: typography.sizes.lg,
                  }
                : undefined
            }
            accessibilityRole="header"
          >
            {isEditing ? 'Edit Weight' : 'Log Weight'}
          </Text>
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

        {/* The number you came to type is first and focused. The date was
            above it, so logging today's weight — every time but a backfill —
            started by scrolling past a control you did not need. */}
        <Text
          className={`text-text-secondary ${textRoles.sectionLabel} mb-1.5`}
          style={
            Platform.OS === 'web'
              ? {
                  color: colors['text-secondary'],
                  fontFamily: typography.fonts.sans,
                  fontSize: typography.sizes.xs,
                }
              : undefined
          }
        >
          Weight
        </Text>
        <NumericInput
          ref={weightRef}
          InputComponent={BottomSheetTextInput}
          value={weightInput}
          onChangeText={setWeightInput}
          suffix={unitLabel(weightUnit)}
          integerOnly={false}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          maxLength={6}
          accessibilityLabel={
            weightUnit === 'kg' ? 'Body weight in kilograms' : 'Body weight in pounds'
          }
        />

        {/* Backfilling another day is the rare case, so it is a link rather
            than a picker sitting open. */}
        <TouchableOpacity
          className="flex-row items-center justify-center gap-1 h-11 my-2"
          onPress={() => setDatePickerOpen((open) => !open)}
          accessibilityLabel={`Change date, currently ${formatDisplayDate(date)}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: datePickerOpen }}
          activeOpacity={0.7}
        >
          <Text
            className={`text-text-secondary ${textRoles.body}`}
            style={
              Platform.OS === 'web'
                ? {
                    color: colors['text-secondary'],
                    fontFamily: typography.fonts.sans,
                    fontSize: typography.sizes.sm,
                  }
                : undefined
            }
          >
            {isToday ? `Today · ${formatDisplayDate(date)}` : formatDisplayDate(date)}
          </Text>
          <Icon name={datePickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color="text-secondary" />
        </TouchableOpacity>

        {datePickerOpen ? (
          <View className="mb-4">
            <WorkoutDatePicker value={date} onChange={setDate} />
          </View>
        ) : null}

        <Button
          label={isEditing ? 'Save' : 'Log weight'}
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={!canSubmit}
          accessibilityLabel={isEditing ? 'Save weight entry' : 'Log weight entry'}
        />

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
