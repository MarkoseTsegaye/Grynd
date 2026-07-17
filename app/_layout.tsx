import '../src/global.css';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { View } from 'react-native';
import { usePrefsStore } from '../src/shared/store/prefsStore';
import { useResumeWorkoutPrompt } from '../src/features/workout';
import { DevBadge } from '../src/shared/components/DevBadge';
import { colors } from '../src/shared/theme/colors';
import { typography } from '../src/shared/theme/typography';

const stackHeaderOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: colors['surface-1'] },
  headerTintColor: colors['text-primary'],
  headerTitleStyle: {
    fontFamily: typography.fonts.sansBold,
    fontSize: typography.sizes.base,
  },
  headerShadowVisible: false,
} as const;

export default function RootLayout() {
  useResumeWorkoutPrompt();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  const { loadPrefs } = usePrefsStore();

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  if (!fontsLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors['surface-0'] },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="workout/[splitId]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen
            name="splits/[splitId]"
            options={{
              animation: 'slide_from_right',
              ...stackHeaderOptions,
              headerTitle: 'Manage Split',
            }}
          />
          <Stack.Screen
            name="history/[sessionId]"
            options={{
              animation: 'slide_from_right',
              ...stackHeaderOptions,
              headerTitle: 'Session',
            }}
          />
          <Stack.Screen
            name="cycle"
            options={{
              animation: 'slide_from_right',
              ...stackHeaderOptions,
              headerTitle: 'Training Cycle',
            }}
          />
          <Stack.Screen
            name="progress"
            options={{
              animation: 'slide_from_right',
              ...stackHeaderOptions,
              headerTitle: 'Progress',
            }}
          />
        </Stack>
        <DevBadge />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
