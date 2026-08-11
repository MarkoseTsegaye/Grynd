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
import { textRoles } from '../../src/shared/theme/typography';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessions, isLoaded, deleteSession } = useHistory();
  const currentOpenRef = useRef<Swipeable | null>(null);
  const [splitFilter, setSplitFilter] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  const splitNames = useMemo(() => getSplitFilters(sessions), [sessions]);
  const visibleSessions = useMemo(
    () => filterSessionsBySplit(sessions, splitFilter),
    [sessions, splitFilter],
  );

  const handleDelete = useCallback(
    async (id: string, swipeableRef: Swipeable) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      swipeableRef.close();
      await deleteSession(id);
    },
    [deleteSession],
  );

  const renderRightActions = useCallback(
    (id: string, swipeableRef: React.RefObject<Swipeable | null>) => (
      <TouchableOpacity
        className="bg-danger items-center justify-center rounded-lg mb-4"
        style={{ width: 80 }}
        onPress={() => swipeableRef.current && handleDelete(id, swipeableRef.current)}
        accessibilityLabel="Delete session"
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
        <TouchableOpacity
          onPress={() => router.push('/progress/volume')}
          accessibilityLabel="View workout volume chart"
          accessibilityRole="button"
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Icon name="chart-line" size={24} color="text-secondary" />
        </TouchableOpacity>
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
          {[null, ...splitNames].map((name) => {
            const selected = splitFilter === name;
            return (
              <TouchableOpacity
                key={name ?? 'all'}
                className={`rounded-lg px-4 h-10 items-center justify-center ${selected ? 'bg-accent' : 'bg-surface-1'}`}
                onPress={() => setSplitFilter(name)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={name ? `Show ${name} sessions` : 'Show all sessions'}
                activeOpacity={0.7}
              >
                <Text
                  className={`${textRoles.toggleLabel} ${selected ? 'text-surface-0' : 'text-text-secondary'}`}
                >
                  {name ?? 'All'}
                </Text>
              </TouchableOpacity>
            );
          })}
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
        renderItem={({ item: session }) => {
          const swipeableRef = React.createRef<Swipeable>();
          return (
            <Swipeable
              ref={swipeableRef}
              renderRightActions={() => renderRightActions(session.id, swipeableRef)}
              overshootRight={false}
              onSwipeableWillOpen={() => {
                if (currentOpenRef.current && currentOpenRef.current !== swipeableRef.current) {
                  currentOpenRef.current.close();
                }
                currentOpenRef.current = swipeableRef.current;
              }}
            >
              <SessionCard
                session={session}
                onPress={() => router.push(`/history/${session.id}`)}
              />
            </Swipeable>
          );
        }}
      />
    </View>
  );
}
