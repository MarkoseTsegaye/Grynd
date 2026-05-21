import React from 'react';
import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../../src/shared/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors['surface-1'], borderTopColor: colors['surface-2'] },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors['text-secondary'],
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 12 },
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
    </Tabs>
  );
}
