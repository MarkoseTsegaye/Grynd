import React, { type RefObject } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import type { Exercise } from '../../splits/types';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  onChange: (index: number) => void;
  /** The exercise being replaced — not offered as its own replacement. */
  currentExerciseId?: string;
  /** The picked library exercise replaces the planned one for this session. */
  onConfirm: (exercise: Exercise) => void;
  onClose: () => void;
}

/**
 * Swap the exercise you planned for the one you're actually doing.
 *
 * This used to be a bare text box: you retyped a name, and the substitute
 * was stored under a freshly generated id with no library row behind it.
 * That made it unopenable from Trends, invisible to momentum ranking, and
 * unable to accumulate history — substituting the same movement twice
 * produced two unrelated ids. It now picks a real exercise, like adding one.
 */
export function SubstituteExerciseSheet({
  sheetRef,
  onChange,
  currentExerciseId,
  onConfirm,
  onClose,
}: Props) {
  return (
    <ExercisePickerSheet
      sheetRef={sheetRef}
      title="Substitute exercise"
      searchPlaceholder="Search or add new..."
      emptyHint="No exercises in your library yet. Type a name to create one."
      selectVerb="Substitute with"
      excludeExerciseId={currentExerciseId}
      onSelect={onConfirm}
      onChange={onChange}
      onClose={onClose}
    />
  );
}
