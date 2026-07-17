import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { BottomSheetModal, BottomSheetFlatList, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useCycleStore } from '../src/features/splits/store/cycleStore';
import { useSplitsStore } from '../src/features/splits';
import { Icon } from '../src/shared/components/Icon';
import type { CycleDay } from '../src/features/splits/types';
import type { Split } from '../src/features/splits/types';
import { textRoles } from '../src/shared/theme/typography';
import { colors } from '../src/shared/theme/colors';

function HeaderDoneButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="px-4 py-2"
      accessibilityLabel="Done editing training cycle"
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Text className={`text-accent ${textRoles.buttonLabel}`}>Done</Text>
    </TouchableOpacity>
  );
}

export default function CycleScreen() {
  const router = useRouter();
  const { cycle, isLoaded, loadCycle, reorderDays, addSplitDay, addRestDay, removeDay } =
    useCycleStore();
  const { splits, isLoaded: splitsLoaded, loadData } = useSplitsStore();

  const insets = useSafeAreaInsets();
  const splitPickerRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%'], []);

  const openSplitPicker = useCallback(() => splitPickerRef.current?.present(), []);
  const closeSplitPicker = useCallback(() => splitPickerRef.current?.dismiss(), []);

  const handleDone = useCallback(() => {
    closeSplitPicker();
    router.back();
  }, [closeSplitPicker, router]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  useEffect(() => {
    if (!isLoaded) loadCycle();
    if (!splitsLoaded) loadData();
  }, [isLoaded, loadCycle, splitsLoaded, loadData]);

  if (!isLoaded || !splitsLoaded) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center">
        <ActivityIndicator color="#E8FF47" />
      </View>
    );
  }

  const days = cycle?.days ?? [];
  const splitDayCount = days.filter((d) => d.type === 'split').length;

  function renderItem({ item, drag, isActive }: { item: CycleDay; drag: () => void; isActive: boolean }) {
    const split = item.type === 'split' ? splits.find((s) => s.id === item.splitId) : null;
    const canDelete = !(item.type === 'split' && splitDayCount <= 1);

    return (
      <ScaleDecorator>
        <View
          className={`flex-row items-center rounded-lg px-4 py-4 mb-2 ${item.type === 'rest' ? 'bg-surface-1' : 'bg-surface-2'} ${isActive ? 'opacity-80' : ''}`}
        >
          <TouchableOpacity onLongPress={drag} delayLongPress={150} className="pr-3" accessibilityLabel="Drag to reorder">
            <Icon name="drag-vertical" size={24} color="text-secondary" />
          </TouchableOpacity>

          <View className="flex-1 flex-row items-center gap-2">
            {item.type === 'split' ? (
              <>
                <Icon name="dumbbell" size={20} color="text-secondary" />
                <Text className={`text-text-primary ${textRoles.cardTitle} flex-1`} numberOfLines={1}>
                  {split?.name ?? 'Unknown split'}
                </Text>
              </>
            ) : (
              <>
                <Icon name="sleep" size={20} color="text-secondary" />
                <Text className={`text-text-secondary ${textRoles.cardTitle}`}>Rest</Text>
              </>
            )}
          </View>

          <TouchableOpacity
            onPress={() => canDelete && removeDay(item.id)}
            className={`ml-2 ${!canDelete ? 'opacity-30' : ''}`}
            disabled={!canDelete}
            accessibilityLabel="Remove day"
            activeOpacity={0.7}
          >
            <Icon name="close-circle" size={16} color="text-disabled" />
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    );
  }

  function renderSplitPickerItem({ item: split }: { item: Split }) {
    return (
      <TouchableOpacity
        className="py-4 px-4 rounded-lg mb-2 bg-surface-2 flex-row items-center gap-3"
        onPress={() => {
          addSplitDay(split.id);
          closeSplitPicker();
        }}
        accessibilityLabel={`Add ${split.name}`}
        activeOpacity={0.7}
      >
        <Icon name="dumbbell" size={20} color="text-secondary" />
        <Text className={`text-text-primary ${textRoles.listItemTitle}`}>{split.name}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => <HeaderDoneButton onPress={handleDone} />,
        }}
      />
      <SafeAreaView className="flex-1 bg-surface-0" edges={['bottom', 'left', 'right']}>
        {days.length > 0 && (
          <View className="px-5 pt-4 pb-2">
            <Text className={`text-text-secondary ${textRoles.bodySmall}`}>
              {days.length} days · Repeats indefinitely
            </Text>
          </View>
        )}

        {days.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Icon name="sync-circle" size={48} color="text-disabled" />
            <Text className={`text-text-secondary ${textRoles.body} text-center mt-4`}>
              No cycle configured.{'\n'}Add split and rest days below.
            </Text>
          </View>
        ) : (
          <DraggableFlatList
            data={days}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onDragEnd={({ data }) => reorderDays(data)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
          />
        )}

        {/* Add buttons */}
        <View className="px-5 pb-6 flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-surface-1 border border-surface-2 rounded-lg py-4 flex-row items-center justify-center gap-2"
            onPress={openSplitPicker}
            accessibilityLabel="Add split day"
            activeOpacity={0.7}
          >
            <Icon name="plus-circle-outline" size={20} color="accent" />
            <Text className={`text-accent ${textRoles.buttonLabel}`}>Add Split Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-surface-1 border border-surface-2 rounded-lg py-4 flex-row items-center justify-center gap-2"
            onPress={addRestDay}
            accessibilityLabel="Add rest day"
            activeOpacity={0.7}
          >
            <Icon name="sleep" size={20} color="text-secondary" />
            <Text className={`text-text-secondary ${textRoles.buttonLabel}`}>Add Rest Day</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Split picker bottom sheet */}
      <BottomSheetModal
        ref={splitPickerRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        bottomInset={insets.bottom}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors['surface-1'] }}
        handleIndicatorStyle={{ backgroundColor: colors['text-disabled'] }}
      >
        <View accessibilityViewIsModal>
          <View className="px-5 pt-2 pb-3">
            <Text
              className={`text-text-primary ${textRoles.modalTitle}`}
              accessibilityRole="header"
              accessibilityLabel="Select a split"
            >
              Select a split
            </Text>
          </View>
          {splits.length === 0 ? (
            <View className="px-5">
              <Text className={`text-text-disabled ${textRoles.body}`} accessibilityLabel="No splits yet.">
                No splits yet.
              </Text>
            </View>
          ) : (
            <BottomSheetFlatList
              data={splits}
              keyExtractor={(item) => item.id}
              renderItem={renderSplitPickerItem}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            />
          )}
        </View>
      </BottomSheetModal>
    </>
  );
}
