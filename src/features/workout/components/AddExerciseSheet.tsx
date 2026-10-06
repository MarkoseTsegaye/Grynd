import React, { type RefObject } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ExercisePickerSheet } from './ExercisePickerSheet';
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
 * Add a one-off exercise to the live session.
 *
 * Deliberately does NOT append the exercise to the current split — the
 * feature is one-off addition to the live session.
 */
export function AddExerciseSheet({ sheetRef, onSelect, onChange }: Props) {
  return (
    <ExercisePickerSheet
      sheetRef={sheetRef}
      title="Add exercise"
      selectVerb="Add"
      onSelect={onSelect}
      onChange={onChange}
    />
  );
}
