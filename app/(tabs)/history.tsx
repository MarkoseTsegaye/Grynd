import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useHistory, SessionCard } from '../../src/features/history';
import { Icon } from '../../src/shared/components/Icon';
import { textRoles } from '../../src/shared/theme/typography';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessions, isLoaded, deleteSession } = useHistory();
  const currentOpenRef = useRef<Swipeable | null>(null);

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

  if (!isLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  if (sessions.length === 0) {
    return (
      <View className="flex-1 bg-surface-0">
        <View
          className="px-5 pb-4 flex-row items-center justify-between"
          style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
        >
          <Text className={`text-text-primary ${textRoles.screenTitle}`}>History</Text>
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
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="clipboard-text-outline" size={48} color="text-disabled" />
          <Text className={`text-text-secondary ${textRoles.body} text-center mt-4`}>
            No completed workouts yet.{'\n'}Finish a session to see it here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-0">
      <View
        className="px-5 pb-4 flex-row items-center justify-between"
        style={{ paddingTop: Platform.OS === 'web' ? Math.max(insets.top + 8, 56) : 56 }}
      >
        <Text className={`text-text-primary ${textRoles.screenTitle}`}>History</Text>
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
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
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
