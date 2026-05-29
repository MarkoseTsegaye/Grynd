import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSessionDetail, SessionDetail } from '../../src/features/history';
import { useHistoryStore } from '../../src/features/history';
import { useEffect } from 'react';
import { textRoles } from '../../src/shared/theme/typography';

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { isLoaded, loadSessions } = useHistoryStore();
  const session = useSessionDetail(sessionId);

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

  return <SessionDetail session={session} />;
}
