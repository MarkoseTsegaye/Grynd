import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useManageSplit } from '../../src/features/splits';
import { useSplitsStore } from '../../src/features/splits';
import { useCycleStore } from '../../src/features/splits/store/cycleStore';
import { useHistory } from '../../src/features/history';
import { ExerciseAttributeControls } from '../../src/features/splits/components/ExerciseAttributeControls';
import { EditExerciseSheet } from '../../src/features/splits/components/EditExerciseSheet';
import { getCycleUsage } from '../../src/features/splits/lib/cycleUsage';
import { getLastSetForExercise } from '../../src/features/splits/lib/exerciseHistory';
import { validateSplitName } from '../../src/features/splits/lib/splitName';
import { showDialog } from '../../src/shared/lib/dialog';
import { Icon } from '../../src/shared/components/Icon';
import { usePrefsStore } from '../../src/shared/store/prefsStore';
import type { Exercise } from '../../src/features/splits/types';
import { textRoles } from '../../src/shared/theme/typography';

export default function ManageSplitScreen() {
  const { splitId } = useLocalSearchParams<{ splitId: string }>();
  const router = useRouter();
  const { reorderExercises, isLoaded, splits, renameSplit } = useSplitsStore();
  const { cycle, isLoaded: cycleLoaded, loadCycle } = useCycleStore();
  const { sessions } = useHistory();
  const { weightUnit } = usePrefsStore();
  const editSheetRef = useRef<BottomSheetModal>(null);

  // The cycle store is not loaded by this route, so without this every split
  // reads as "not in cycle" here.
  useEffect(() => {
    if (!cycleLoaded) void loadCycle();
  }, [cycleLoaded, loadCycle]);

  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  const {
    split,
    exercises,
    newExerciseName,
    setNewExerciseName,
    newUnilateral,
    setNewUnilateral,
    newPlateLoaded,
    setNewPlateLoaded,
    isAdding,
    error,
    editingExercise,
    setEditingExercise,
    handleAddExercise,
    handleUpdateExercise,
    handleRemoveExercise,
  } = useManageSplit(splitId);

  const cycleUsage = useMemo(
    () => getCycleUsage(cycle?.days ?? [], splitId),
    [cycle, splitId],
  );

  const lastSetByExercise = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const exercise of exercises) {
      map[exercise.id] = getLastSetForExercise(sessions, exercise.id, weightUnit);
    }
    return map;
  }, [exercises, sessions, weightUnit]);

  const openEdit = useCallback(
    (exercise: Exercise) => {
      setEditingExercise(exercise);
      requestAnimationFrame(() => editSheetRef.current?.present());
    },
    [setEditingExercise],
  );

  // Deleting an exercise was instant and irreversible; it drops the plan and
  // orphans nothing visibly, so it deserves the same confirm as a split.
  const confirmRemove = useCallback(
    (exercise: Exercise) => {
      showDialog(
        `Remove ${exercise.name}?`,
        'It comes out of this split. Sets already logged in past workouts are kept.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => void handleRemoveExercise(exercise.id),
          },
        ],
      );
    },
    [handleRemoveExercise],
  );

  const startRename = useCallback(() => {
    if (!split) return;
    setDraftName(split.name);
    setIsRenaming(true);
  }, [split]);

  const commitRename = useCallback(async () => {
    if (!split) return;
    const validation = validateSplitName(
      draftName,
      splits.filter((s) => s.id !== split.id).map((s) => s.name),
    );
    if (!validation.ok) {
      showDialog('Cannot rename', validation.error);
      return;
    }
    await renameSplit(split.id, validation.name);
    setIsRenaming(false);
  }, [draftName, renameSplit, split, splits]);

  const closeAdd = useCallback(() => {
    setIsAddingOpen(false);
    setNewExerciseName('');
  }, [setNewExerciseName]);

  const submitAdd = useCallback(async () => {
    await handleAddExercise();
    setIsAddingOpen(false);
  }, [handleAddExercise]);

  if (!isLoaded) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center">
        <Text className={`text-text-secondary ${textRoles.body}`}>Loading...</Text>
      </View>
    );
  }

  if (!split) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center">
        <Text className={`text-text-secondary ${textRoles.body}`}>Split not found.</Text>
      </View>
    );
  }

  const canAdd = !isAdding && newExerciseName.trim().length > 0;

  function renderItem({
    item: exercise,
    drag,
    isActive,
    getIndex,
  }: {
    item: Exercise;
    drag: () => void;
    isActive: boolean;
    getIndex: () => number | undefined;
  }) {
    const lastSet = lastSetByExercise[exercise.id];
    const position = (getIndex() ?? 0) + 1;

    return (
      <ScaleDecorator>
        <View
          className={`flex-row items-center bg-surface-1 rounded-xl mb-2 pl-1 pr-1 ${isActive ? 'opacity-80' : ''}`}
        >
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={150}
            className="px-2 py-4"
            accessibilityLabel={`Drag to reorder ${exercise.name}`}
          >
            <Icon name="drag-vertical" size={18} color="text-disabled" />
          </TouchableOpacity>

          <Text
            className={`text-text-disabled ${textRoles.metricBold}`}
            style={{ width: 14, fontSize: 12 }}
          >
            {position}
          </Text>

          <TouchableOpacity
            className="flex-1 py-3 pl-2"
            onPress={() => openEdit(exercise)}
            accessibilityLabel={`Edit ${exercise.name}`}
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Text className={`text-text-primary ${textRoles.listItemTitle}`} numberOfLines={1}>
              {exercise.name}
            </Text>
            <View className="flex-row items-center flex-wrap gap-1.5 mt-1">
              {exercise.unilateral && (
                <View className="rounded bg-surface-2 px-1.5 py-0.5">
                  <Text className={`text-text-secondary ${textRoles.caption}`} style={{ fontSize: 10 }}>
                    L / R
                  </Text>
                </View>
              )}
              {exercise.plateLoaded && (
                <View className="rounded bg-accent/10 px-1.5 py-0.5">
                  <Text className={`text-accent ${textRoles.caption}`} style={{ fontSize: 10 }}>
                    Plates
                  </Text>
                </View>
              )}
              {lastSet && (
                <Text className={`text-text-disabled ${textRoles.metric}`} style={{ fontSize: 11 }}>
                  last · {lastSet}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => confirmRemove(exercise)}
            accessibilityLabel={`Remove ${exercise.name}`}
            accessibilityRole="button"
            className="px-3 py-4"
            activeOpacity={0.7}
          >
            <Icon name="trash-can-outline" size={18} color="text-disabled" />
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    );
  }

  const header = (
    <>
      <View className="flex-row items-center gap-2 mb-0.5">
        {isRenaming ? (
          <TextInput
            className={`flex-1 bg-surface-2 text-text-primary ${textRoles.body} rounded-lg px-3 py-2`}
            value={draftName}
            onChangeText={setDraftName}
            onSubmitEditing={commitRename}
            onBlur={commitRename}
            returnKeyType="done"
            autoFocus
            maxLength={40}
            accessibilityLabel="Split name"
          />
        ) : (
          <>
            <Text
              className={`text-text-primary ${textRoles.listTitle} flex-shrink`}
              numberOfLines={1}
            >
              {split.name}
            </Text>
            <TouchableOpacity
              onPress={startRename}
              accessibilityLabel={`Rename ${split.name}`}
              accessibilityRole="button"
              hitSlop={10}
              activeOpacity={0.7}
            >
              <Icon name="pencil-outline" size={16} color="text-disabled" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text className={`text-text-secondary ${textRoles.caption} mb-4`}>
        {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
        {cycleUsage.label ? ` · used on ${cycleUsage.label}` : ''}
      </Text>

      {!cycleUsage.inCycle && (
        <TouchableOpacity
          className="flex-row items-start gap-2.5 bg-surface-1 rounded-xl px-3.5 py-3 mb-3"
          onPress={() => router.push('/cycle')}
          accessibilityRole="button"
          accessibilityLabel="This split is not in your training cycle. Open the cycle editor."
          activeOpacity={0.7}
        >
          <Icon name="alert-circle-outline" size={18} color="warning" />
          <View className="flex-1">
            <Text className={`text-text-primary ${textRoles.bodySmall}`}>Not in your cycle</Text>
            <Text className={`text-text-secondary ${textRoles.caption} mt-0.5`}>
              This split won&apos;t come up on any day. Add it to the cycle to see it on Home.
            </Text>
            <Text className={`text-accent ${textRoles.toggleLabel} mt-1.5`}>Add to cycle ›</Text>
          </View>
        </TouchableOpacity>
      )}

      {isAddingOpen ? (
        <View
          className="bg-surface-1 rounded-xl p-3 mb-3"
          style={{ borderWidth: 1, borderColor: 'rgba(232, 255, 71, 0.25)' }}
        >
          <Text
            className={`text-text-disabled ${textRoles.sectionLabel} mb-1.5`}
            style={{ fontSize: 10 }}
          >
            New exercise
          </Text>
          <TextInput
            className={`bg-surface-0 text-text-primary ${textRoles.body} rounded-lg px-3 py-2.5 mb-3`}
            placeholder="Exercise name"
            placeholderTextColor="#3D3B38"
            value={newExerciseName}
            onChangeText={setNewExerciseName}
            returnKeyType="done"
            onSubmitEditing={submitAdd}
            autoFocus
            accessibilityLabel="New exercise name"
          />

          <ExerciseAttributeControls
            unilateral={newUnilateral}
            plateLoaded={newPlateLoaded}
            onChangeUnilateral={setNewUnilateral}
            onChangePlateLoaded={setNewPlateLoaded}
          />

          {error ? (
            <Text className={`text-danger ${textRoles.caption} mt-1`}>{error}</Text>
          ) : null}

          <View className="flex-row gap-2 mt-3">
            <TouchableOpacity
              className="flex-1 bg-surface-2 rounded-lg items-center justify-center"
              style={{ height: 44 }}
              onPress={closeAdd}
              accessibilityLabel="Cancel adding exercise"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text className={`text-text-primary ${textRoles.buttonLabelSmall}`}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 bg-accent rounded-lg flex-row items-center justify-center gap-1.5 ${canAdd ? '' : 'opacity-40'}`}
              style={{ height: 44 }}
              onPress={submitAdd}
              disabled={!canAdd}
              accessibilityLabel="Add exercise"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Icon name="plus" size={17} color="surface-0" />
              <Text className={`text-surface-0 ${textRoles.buttonLabelSmall}`}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 rounded-xl py-3.5 mb-3"
          style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: '#3D3B38' }}
          onPress={() => setIsAddingOpen(true)}
          accessibilityLabel="Add exercise"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Icon name="plus" size={17} color="text-secondary" />
          <Text className={`text-text-secondary ${textRoles.toggleLabel}`}>Add exercise</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <View className="flex-1 bg-surface-0">
      {exercises.length === 0 ? (
        <View className="flex-1 px-5 pt-4">
          {header}
          <View className="bg-surface-1 rounded-2xl items-center px-6 py-7 gap-2.5">
            <View
              className="bg-surface-2 rounded-2xl items-center justify-center"
              style={{ width: 52, height: 52 }}
            >
              <Icon name="dumbbell" size={24} color="text-disabled" />
            </View>
            <Text className={`text-text-primary ${textRoles.cardTitle}`}>
              Nothing in this split yet
            </Text>
            <Text className={`text-text-secondary ${textRoles.bodySmall} text-center`}>
              Add the exercises you&apos;ll do, in the order you&apos;ll do them. You can reorder
              any time by dragging.
            </Text>
          </View>
        </View>
      ) : (
        <DraggableFlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorderExercises(splitId, data.map((e) => e.id))}
          ListHeaderComponent={<View className="pt-4">{header}</View>}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        />
      )}

      <EditExerciseSheet
        sheetRef={editSheetRef}
        exercise={editingExercise}
        onSave={handleUpdateExercise}
        onRemove={confirmRemove}
        onClose={() => setEditingExercise(null)}
      />
    </View>
  );
}
