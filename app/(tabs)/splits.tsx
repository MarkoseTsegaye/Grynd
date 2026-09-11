import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Swipeable } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useSplitsList, SplitCard } from '../../src/features/splits';
import { useSplitsStore } from '../../src/features/splits';
import { CreateSplitSheet } from '../../src/features/splits/components/CreateSplitSheet';
import { Button } from '../../src/shared/components/Button';
import { Icon } from '../../src/shared/components/Icon';
import { useCycleStore } from '../../src/features/splits/store/cycleStore';
import { useHistory } from '../../src/features/history';
import { getCycleUsage } from '../../src/features/splits/lib/cycleUsage';
import { getSplitActivity } from '../../src/features/splits/lib/splitActivity';
import { STORAGE_KEYS } from '../../src/storage/keys';
import type { Split } from '../../src/features/splits/types';
import { textRoles } from '../../src/shared/theme/typography';

const FLOATING_CTA_HEIGHT = 56;
const FLOATING_CTA_GAP = 12;

export default function SplitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { splits, isLoaded } = useSplitsList();
  const { getExercisesForSplit, reorderSplits, deleteSplit } = useSplitsStore();
  const { cycle, isLoaded: cycleLoaded, loadCycle } = useCycleStore();
  const { sessions } = useHistory();

  // Without this the cycle is null here and every split reads "not in cycle".
  useEffect(() => {
    if (!cycleLoaded) void loadCycle();
  }, [cycleLoaded, loadCycle]);

  const createSheetRef = useRef<BottomSheetModal>(null);

  // Delete confirmation
  const deleteSheetRef = useRef<BottomSheetModal>(null);
  const deleteSnapPoints = useMemo(() => ['35%'], []);
  const [pendingDeleteSplit, setPendingDeleteSplit] = useState<Split | null>(null);

  // Same registry as History: a ref created inside renderItem is a new object
  // every render, so "close the previously open row" compares against stale refs.
  const swipeableRefs = useRef(new Map<string, Swipeable>());
  const currentOpenId = useRef<string | null>(null);

  // The hint retires itself once either gesture has been used.
  const [showGestureHint, setShowGestureHint] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEYS.SPLITS_GESTURE_HINT_SEEN).then((seen) => {
      if (!seen) setShowGestureHint(true);
    });
  }, []);
  const retireGestureHint = useCallback(() => {
    setShowGestureHint((visible) => {
      if (visible) void AsyncStorage.setItem(STORAGE_KEYS.SPLITS_GESTURE_HINT_SEEN, 'true');
      return false;
    });
  }, []);

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
  }, [pendingDeleteSplit, deleteSplit]);

  const handleCancelDelete = useCallback(() => {
    deleteSheetRef.current?.dismiss();
  }, []);

  // Runs for every close — Cancel, backdrop tap, or pan-down. Backing out of a
  // destructive action shouldn't leave the row sitting open on its red button.
  const handleSheetDismissed = useCallback(() => {
    setPendingDeleteSplit((split) => {
      if (split) swipeableRefs.current.get(split.id)?.close();
      return null;
    });
  }, []);

  const handleOpenCreate = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createSheetRef.current?.present();
  }, []);

  const renderRightActions = useCallback(
    (split: Split) => (
      <TouchableOpacity
        className="bg-danger items-center justify-center rounded-lg mb-3"
        style={{ width: 80 }}
        onPress={() => openDeleteSheet(split)}
        accessibilityLabel={`Delete ${split.name}`}
        activeOpacity={0.8}
      >
        <Icon name="trash-can-outline" size={24} color="text-primary" />
      </TouchableOpacity>
    ),
    [openDeleteSheet],
  );

  const ctaBottomOffset = FLOATING_CTA_GAP;
  const listBottomPadding = ctaBottomOffset + FLOATING_CTA_HEIGHT + 16;

  const createSheet = (
    <CreateSplitSheet
      sheetRef={createSheetRef}
      onCreated={(id) => router.push(`/splits/${id}`)}
    />
  );

  if (!isLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  function renderItem({ item: split, drag, isActive }: { item: Split; drag: () => void; isActive: boolean }) {
    const card = (
      <SplitCard
        split={split}
        exerciseCount={getExercisesForSplit(split.id).length}
        lastPerformedLabel={getSplitActivity(sessions, split.id).label}
        cycleLabel={getCycleUsage(cycle?.days ?? [], split.id).label}
        showNotInCycle={!getCycleUsage(cycle?.days ?? [], split.id).inCycle}
        onDrag={drag}
        onManage={() => router.push(`/splits/${split.id}`)}
      />
    );

    return (
      <ScaleDecorator>
        <View className={isActive ? 'bg-surface-2 rounded-lg' : ''}>
          {/* Two pan handlers share this row — the list's drag (armed only by
              the handle's long-press) and the swipe. Suppressing the swipe on
              the row being dragged keeps them from racing mid-drag. */}
          {isActive ? (
            card
          ) : (
            <Swipeable
              ref={(row) => {
                if (row) swipeableRefs.current.set(split.id, row);
                else swipeableRefs.current.delete(split.id);
              }}
              renderRightActions={() => renderRightActions(split)}
              overshootRight={false}
              onSwipeableWillOpen={() => {
                retireGestureHint();
                const openId = currentOpenId.current;
                if (openId && openId !== split.id) {
                  swipeableRefs.current.get(openId)?.close();
                }
                currentOpenId.current = split.id;
              }}
            >
              {card}
            </Swipeable>
          )}
        </View>
      </ScaleDecorator>
    );
  }

  if (splits.length === 0) {
    return (
      <View className="flex-1 bg-surface-0">
        <View
          className="px-5 pb-4"
          style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
        >
          <Text className={`text-text-primary ${textRoles.screenTitle}`}>Splits</Text>
        </View>
        {/* One CTA, where the eye already is — the floating button would be a
            second accent target saying the same thing. */}
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="dumbbell" size={48} color="text-disabled" />
          <Text className={`text-text-secondary ${textRoles.body} text-center mt-4 mb-6`}>
            Create your first split to get started.
          </Text>
          <Button label="Create your first split" icon="plus" onPress={() => void handleOpenCreate()} />
        </View>
        {createSheet}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-0">
      <View
        className="px-5 pb-4"
        style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
      >
        <Text className={`text-text-primary ${textRoles.screenTitle}`}>Splits</Text>
      </View>

      <DraggableFlatList
        data={splits}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => {
          retireGestureHint();
          void reorderSplits(data);
        }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: listBottomPadding }}
        ListFooterComponent={
          showGestureHint && splits.length > 1 ? (
            <Text className={`text-text-secondary ${textRoles.caption} text-center pt-1`}>
              Swipe left to delete · hold the handle to reorder
            </Text>
          ) : null
        }
      />

      {!pendingDeleteSplit && (
        <View
          className="absolute left-5 right-5"
          style={{ bottom: ctaBottomOffset }}
          pointerEvents="box-none"
        >
          <View
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Button
              label="New Split"
              icon="plus"
              onPress={() => void handleOpenCreate()}
              accessibilityLabel="Create new split"
            />
          </View>
        </View>
      )}

      {createSheet}

      {/* Delete confirmation sheet */}
      <BottomSheetModal
        ref={deleteSheetRef}
        snapPoints={deleteSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onDismiss={handleSheetDismissed}
        backgroundStyle={{ backgroundColor: '#141414' }}
        handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
      >
        <BottomSheetView className="px-6 pb-8 pt-2">
          <Text className={`text-text-primary ${textRoles.modalTitle} mb-1`}>
            Delete {pendingDeleteSplit?.name ?? 'Split'}?
          </Text>
          <Text className={`text-text-secondary ${textRoles.bodySmall} mb-6`}>
            This removes it from every device you&apos;re signed in on and cannot be undone. Any
            cycle days using this split will be set to rest days.
          </Text>
          <TouchableOpacity
            className="bg-danger rounded-lg py-4 items-center mb-3"
            onPress={handleConfirmDelete}
            accessibilityLabel="Confirm delete split"
            activeOpacity={0.7}
          >
            <Text className={`text-text-primary ${textRoles.buttonLabel}`}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-surface-2 rounded-lg py-4 items-center"
            onPress={handleCancelDelete}
            accessibilityLabel="Cancel delete"
            activeOpacity={0.7}
          >
            <Text className={`text-text-secondary ${textRoles.buttonLabel}`}>Cancel</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
