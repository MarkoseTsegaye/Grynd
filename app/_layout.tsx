import '../src/global.css';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { AppState, View } from 'react-native';
import { usePrefsStore } from '../src/shared/store/prefsStore';
import { useResumeWorkoutPrompt } from '../src/features/workout';
import { useAuthStore } from '../src/features/auth';
import { startSyncEngine, pull as syncPull } from '../src/storage/sync';
import { DevBadge } from '../src/shared/components/DevBadge';

const stackHeader = {
  headerShown: true,
  headerStyle: { backgroundColor: '#141414' },
  headerTintColor: '#F0EDE8',
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
  const bootstrapAuth = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    // Anonymous bootstrap — see plan-of-record. On first launch this creates
    // a real UID silently so the user can start writing data immediately;
    // on subsequent launches it just restores the persisted session. When
    // Supabase env vars aren't set, this resolves to `status: 'unconfigured'`
    // and every downstream auth call becomes a no-op.
    void bootstrapAuth();

    // Fire and forget — the engine sits idle until auth resolves a UID
    // and does nothing at all when Supabase is unconfigured.
    startSyncEngine();

    // Pull on foreground resume so a device that's been asleep for a
    // while catches up before the user starts editing.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncPull();
    });
    return () => sub.remove();
  }, [bootstrapAuth]);

  if (!fontsLoaded) {
    return <View className="flex-1 bg-surface-0" />;
  }

  return (
    // SafeAreaProvider is required for SafeAreaView / useSafeAreaInsets to
    // report real insets. Without it they silently resolve to 0, which put
    // content under the notch and clipped the tab bar above the home indicator.
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <BottomSheetModalProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="workout/[splitId]"
            options={{
              animation: 'slide_from_bottom',
              gestureEnabled: false,
              headerBackButtonMenuEnabled: false,
            }}
          />
          <Stack.Screen
            name="splits/[splitId]"
            options={{ animation: 'slide_from_right', ...stackHeader, headerTitle: 'Manage Split' }}
          />
          <Stack.Screen
            name="history/[sessionId]"
            options={{ animation: 'slide_from_right', ...stackHeader, headerTitle: 'Session' }}
          />
          <Stack.Screen
            name="cycle"
            options={{ animation: 'slide_from_right', ...stackHeader, headerTitle: 'Training Cycle' }}
          />
          <Stack.Screen
            name="progress/volume"
            options={{ animation: 'slide_from_right', ...stackHeader, headerTitle: 'Workout Volume' }}
          />
          <Stack.Screen
            name="progress/split/[splitId]"
            options={{ animation: 'slide_from_right', ...stackHeader, headerTitle: 'Exercises' }}
          />
          <Stack.Screen
            name="progress/exercise/[exerciseId]"
            options={{ animation: 'slide_from_right', ...stackHeader, headerTitle: 'Progress' }}
          />
        </Stack>
        <DevBadge />
      </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
