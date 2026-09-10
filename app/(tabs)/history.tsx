import React, { useRef, useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useHistory, SessionCard } from '../../src/features/history';
import { SetLegend } from '../../src/features/history/components/SetLegend';
import {
  filterSessionsBySplit,
  getSplitFilters,
} from '../../src/features/history/lib/sessionSummary';
import { Icon } from '../../src/shared/components/Icon';
import { Chip } from '../../src/shared/components/Chip';
import { showDialog } from '../../src/shared/lib/dialog';
import { formatShortDate } from '../../src/shared/lib/date';
import { textRoles } from '../../src/shared/theme/typography';
import type { WorkoutSession } from '../../src/features/workout/types';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessions, isLoaded, deleteSession } = useHistory();
  // Keyed by session id rather than a ref created inside renderItem —
  // that produced a fresh ref object on every render, so the
  // "close the previously open row" check compared against stale refs
  // and only worked by accident.
  const swipeableRefs = useRef(new Map<string, Swipeable>());
  const currentOpenId = useRef<string | null>(null);
  const [splitFilter, setSplitFilter] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  const splitNames = useMemo(() => getSplitFilters(sessions), [sessions]);
  const visibleSessions = useMemo(
    () => filterSessionsBySplit(sessions, splitFilter),
    [sessions, splitFilter],
  );

  // Deleting a session now propagates to every signed-in device as a
  // sync tombstone, and there is no undo — so it asks first. Declining
  // closes the row rather than leaving it open on a destructive action.
  const handleDelete = useCallback(
    (session: WorkoutSession) => {
      const row = swipeableRefs.current.get(session.id);
      showDialog(
        'Delete workout?',
        `${session.splitName} · ${formatShortDate(session.completedAt ?? session.startedAt)} will be removed from every device you're signed in on. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => row?.close() },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              row?.close();
              void deleteSession(session.id);
            },
          },
        ],
      );
    },
    [deleteSession],
  );

  const renderRightActions = useCallback(
    (session: WorkoutSession) => (
      <TouchableOpacity
        className="bg-danger items-center justify-center rounded-lg mb-4"
        style={{ width: 80 }}
        onPress={() => handleDelete(session)}
        accessibilityLabel={`Delete ${session.splitName} session`}
        activeOpacity={0.8}
      >
        <Icon name="trash-can-outline" size={24} color="text-primary" />
      </TouchableOpacity>
    ),
    [handleDelete],
  );

  const header = (
    <View
      className="px-5 pb-4 flex-row items-center justify-between"
      // Web reads the notch from env(safe-area-inset-*) once viewport-fit=cover
      // is set; the 56 floor keeps the header clear on devices without one.
      style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
    >
      <Text className={`text-text-primary ${textRoles.screenTitle}`}>History</Text>
      <View className="flex-row items-center gap-4">
        {sessions.length > 0 && (
          <TouchableOpacity
            onPress={() => setLegendOpen((open) => !open)}
            accessibilityLabel={legendOpen ? 'Hide set legend' : 'Show set legend'}
            accessibilityRole="button"
            accessibilityState={{ expanded: legendOpen }}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Icon
              name="help-circle-outline"
              size={24}
              color={legendOpen ? 'accent' : 'text-secondary'}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (!isLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  if (sessions.length === 0) {
    return (
      <View className="flex-1 bg-surface-0">
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="clipboard-text-outline" size={48} color="text-disabled" />
          <Text className={`text-text-secondary ${textRoles.body} text-center mt-4`}>
            No completed workouts yet.{'\n'}Finish a session to see it here.
          </Text>
        </View>
      </View>
    );
  }

  const listHeader = (
    <>
      {/* Split filter — only earns its space once history spans more than one split */}
      {splitNames.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
        >
          {[null, ...splitNames].map((name) => (
            <Chip
              key={name ?? 'all'}
              label={name ?? 'All'}
              selected={splitFilter === name}
              onPress={() => setSplitFilter(name)}
              accessibilityLabel={name ? `Show ${name} sessions` : 'Show all sessions'}
            />
          ))}
        </ScrollView>
      )}
      {legendOpen && <SetLegend />}
    </>
  );

  return (
    <View className="flex-1 bg-surface-0">
      {header}
      <FlatList
        data={visibleSessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text className={`text-text-secondary ${textRoles.bodySmall} text-center mt-8`}>
            No {splitFilter} sessions yet.
          </Text>
        }
        renderItem={({ item: session }) => (
          <Swipeable
            ref={(row) => {
              if (row) swipeableRefs.current.set(session.id, row);
              else swipeableRefs.current.delete(session.id);
            }}
            renderRightActions={() => renderRightActions(session)}
            overshootRight={false}
            onSwipeableWillOpen={() => {
              const openId = currentOpenId.current;
              if (openId && openId !== session.id) {
                swipeableRefs.current.get(openId)?.close();
              }
              currentOpenId.current = session.id;
            }}
          >
            <SessionCard
              session={session}
              onPress={() => router.push(`/history/${session.id}`)}
            />
          </Swipeable>
        )}
      />
    </View>
  );
}
