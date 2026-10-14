import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSessionDetail, SessionDetail } from '../../src/features/history';
import { useHistoryStore } from '../../src/features/history';
import {
  formatPersonalBestNames,
  getSessionPersonalBests,
} from '../../src/features/history/lib/sessionPersonalBests';
import { Icon } from '../../src/shared/components/Icon';
import { textRoles } from '../../src/shared/theme/typography';

export default function SessionDetailScreen() {
  const { sessionId, finished } = useLocalSearchParams<{
    sessionId: string;
    finished?: string;
  }>();
  const { isLoaded, loadSessions, sessions } = useHistoryStore();
  const session = useSessionDetail(sessionId);
  const justFinished = finished === '1';

  // Only computed on the finish path — browsing old history doesn't need it.
  const personalBests = useMemo(
    () => (justFinished && session ? getSessionPersonalBests(session, sessions) : []),
    [justFinished, session, sessions],
  );

  useEffect(() => {
    if (!isLoaded) loadSessions();
  }, [isLoaded, loadSessions]);

  if (!isLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  if (!session) {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center">
        <Text className={`text-text-secondary ${textRoles.body}`}>Session not found.</Text>
      </View>
    );
  }

  if (!justFinished) return <SessionDetail session={session} />;

  return (
    <View className="flex-1 bg-surface-0">
      {/* Arriving here straight from finishing, this screen was indistinguishable
          from opening a workout you did three weeks ago. */}
      <Stack.Screen options={{ headerTitle: 'Workout Saved' }} />
      {/* The header already confirms the save, so this earns its space only
          when there is something to celebrate. */}
      {personalBests.length > 0 && (
        <View className="mx-5 mt-4 bg-surface-1 rounded-xl px-4 py-3 flex-row items-center gap-3">
          <Icon name="trophy" size={22} color="accent" />
          <View className="flex-1">
            <Text className={`text-text-primary ${textRoles.cardTitle}`}>
              {personalBests.length === 1 ? 'Personal best' : 'Personal bests'}
            </Text>
            <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`} numberOfLines={2}>
              {formatPersonalBestNames(personalBests)}
            </Text>
          </View>
        </View>
      )}
      <SessionDetail session={session} />
    </View>
  );
}
