import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../../src/shared/theme/colors';
import { typography } from '../../src/shared/theme/typography';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // On web we need enough bottom padding to clear the iOS home indicator, but
  // Apple's env(safe-area-inset-bottom) reserves ~34 px which is much larger
  // than the indicator actually needs and leaves a visibly tall tab bar. Cap
  // it at 10 px — enough clearance so labels don't touch the indicator, small
  // enough that the tab bar feels compact and edge-to-edge. Native tab bars
  // already handle their own insets, so no override on native.
  const bottomInset = Platform.OS === 'web' ? Math.min(insets.bottom, 10) : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors['surface-1'],
          borderTopColor: colors['surface-2'],
          ...(Platform.OS === 'web'
            ? { height: 49 + bottomInset, paddingBottom: bottomInset }
            : null),
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors['text-secondary'],
        tabBarLabelStyle: { fontFamily: typography.fonts.sansMedium, fontSize: typography.sizes.xs },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={focused ? colors.accent : colors['text-secondary']}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="splits"
        options={{
          title: 'Splits',
          tabBarLabel: 'Splits',
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'format-list-checks' : 'format-list-bulleted'}
              size={24}
              color={focused ? colors.accent : colors['text-secondary']}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarLabel: 'Progress',
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'chart-line' : 'chart-line-variant'}
              size={24}
              color={focused ? colors.accent : colors['text-secondary']}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'calendar-month' : 'calendar-month-outline'}
              size={24}
              color={focused ? colors.accent : colors['text-secondary']}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'cog' : 'cog-outline'}
              size={24}
              color={focused ? colors.accent : colors['text-secondary']}
            />
          ),
        }}
      />
    </Tabs>
  );
}
