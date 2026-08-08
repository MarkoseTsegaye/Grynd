import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../../src/shared/theme/colors';
import { typography } from '../../src/shared/theme/typography';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Native tab bars already inset for the home indicator. On web we add both
  // the env(safe-area-inset-bottom) value AND a small minimum so the label row
  // clears the iOS "peekaboo" home indicator even when the browser doesn't
  // report a real inset (e.g. Safari in tab mode without viewport-fit=cover
  // being honored on that page).
  const bottomInset = Platform.OS === 'web' ? Math.max(insets.bottom, 12) : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors['surface-1'],
          borderTopColor: colors['surface-2'],
          ...(bottomInset > 0
            ? { height: 56 + bottomInset, paddingBottom: bottomInset }
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
