import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useSplitsList, SplitCard } from '../../src/features/splits';
import { useSplitsStore } from '../../src/features/splits';
import { useCreateSplit } from '../../src/features/splits';
import { Icon } from '../../src/shared/components/Icon';
import type { Split } from '../../src/features/splits/types';

export default function SplitsScreen() {
  const router = useRouter();
  const { splits, isLoaded } = useSplitsList();
  const { getExercisesForSplit, reorderSplits, deleteSplit } = useSplitsStore();
  const { name, setName, canSubmit, isSubmitting, handleSubmit } = useCreateSplit(
    (id) => router.push(`/splits/${id}`),
  );
  const [showForm, setShowForm] = useState(false);

  // Delete confirmation
  const deleteSheetRef = useRef<BottomSheetModal>(null);
  const deleteSnapPoints = useMemo(() => ['35%'], []);
  const [pendingDeleteSplit, setPendingDeleteSplit] = useState<Split | null>(null);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const openDeleteSheet = useCallback((split: Split) => {
    setPendingDeleteSplit(split);
    deleteSheetRef.current?.present();
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteSplit) return;
    deleteSheetRef.current?.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteSplit(pendingDeleteSplit.id);
    setPendingDeleteSplit(null);
  }, [pendingDeleteSplit, deleteSplit]);

  const handleCancelDelete = useCallback(() => {
    deleteSheetRef.current?.dismiss();
    setPendingDeleteSplit(null);
  }, []);

  if (!isLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  function renderItem({ item: split, drag, isActive }: { item: Split; drag: () => void; isActive: boolean }) {
    return (
      <ScaleDecorator>
        <View className={`flex-row items-center mb-3 ${isActive ? 'opacity-80' : ''}`}>
          <TouchableOpacity onLongPress={drag} delayLongPress={150} className="px-1 py-4" accessibilityLabel="Drag to reorder split">
            <Icon name="drag-vertical" size={24} color="text-secondary" />
          </TouchableOpacity>
          <View className="flex-1">
            <SplitCard
              split={split}
              exerciseCount={getExercisesForSplit(split.id).length}
              onManage={() => router.push(`/splits/${split.id}`)}
              onDelete={() => openDeleteSheet(split)}
            />
          </View>
        </View>
      </ScaleDecorator>
    );
  }

  return (
    <View className="flex-1 bg-surface-0">
      <View className="px-5 pt-14 pb-4 flex-row items-center justify-between">
        <Text className="text-text-primary font-sans-bold text-4xl">Splits</Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.push('/cycle')}
            accessibilityLabel="Training cycle"
            activeOpacity={0.7}
          >
            <Icon name="sync-circle" size={24} color="text-secondary" />
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-accent rounded-lg px-4 py-2"
            onPress={() => setShowForm((v) => !v)}
            accessibilityLabel="Create new split"
            activeOpacity={0.7}
          >
            <Text className="text-surface-0 font-sans-bold text-base">{showForm ? 'Cancel' : '+ New'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showForm && (
        <View className="px-5 mb-4">
          <TextInput
            className="bg-surface-2 text-text-primary font-sans text-base rounded-lg px-4 py-3 mb-3"
            placeholder="Split name (e.g. Push, Legs)"
            placeholderTextColor="#3D3B38"
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={async () => { await handleSubmit(); setShowForm(false); }}
            autoFocus
            accessibilityLabel="Split name input"
          />
          <TouchableOpacity
            className={`bg-accent rounded-lg py-3 items-center ${!canSubmit ? 'opacity-40' : ''}`}
            onPress={async () => { await handleSubmit(); setShowForm(false); }}
            disabled={!canSubmit}
            accessibilityLabel="Save new split"
            activeOpacity={0.7}
          >
            <Text className="text-surface-0 font-sans-bold text-base">
              {isSubmitting ? 'Creating...' : 'Create Split'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {splits.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="dumbbell" size={48} color="text-disabled" />
          <Text className="text-text-secondary font-sans text-base text-center mt-4">
            Create your first split to get started.
          </Text>
        </View>
      ) : (
        <DraggableFlatList
          data={splits}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorderSplits(data)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        />
      )}

      {/* Delete confirmation sheet */}
      <BottomSheetModal
        ref={deleteSheetRef}
        snapPoints={deleteSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onDismiss={() => setPendingDeleteSplit(null)}
        backgroundStyle={{ backgroundColor: '#141414' }}
        handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
      >
        <BottomSheetView className="px-6 pb-8 pt-2">
          <Text className="text-text-primary font-sans-bold text-lg mb-1">
            Delete {pendingDeleteSplit?.name ?? 'Split'}?
          </Text>
          <Text className="text-text-secondary font-sans text-sm mb-6">
            This cannot be undone. Any cycle days using this split will be set to rest days.
          </Text>
          <TouchableOpacity
            className="bg-danger rounded-lg py-4 items-center mb-3"
            onPress={handleConfirmDelete}
            accessibilityLabel="Confirm delete split"
            activeOpacity={0.7}
          >
            <Text className="text-text-primary font-sans-bold text-base">Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-surface-2 rounded-lg py-4 items-center"
            onPress={handleCancelDelete}
            accessibilityLabel="Cancel delete"
            activeOpacity={0.7}
          >
            <Text className="text-text-secondary font-sans-bold text-base">Cancel</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
