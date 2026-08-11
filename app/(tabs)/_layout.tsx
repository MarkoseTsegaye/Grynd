import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../../src/shared/theme/colors';
import { typography } from '../../src/shared/theme/typography';

// React Navigation's BottomTabBar reserves `paddingBottom: insets.bottom`
// (~34 px on iOS) inside the tab bar for the safe-area/home-indicator area
// and then anchors icon+label to the top of the remaining content area. On
// iOS PWAs this produces two visible problems: (1) labels get clipped
// because the label font size was larger than the ~10 px React Navigation
// designs around, and its default content area (49 px) leaves too little
// room; (2) labels float high up with a wide dead strip between them and
// the physical bottom.
//
// Fix on web: shrink the paddingBottom to just enough home-indicator
// clearance (10 px), and anchor each tab item's content to the bottom
// (`justifyContent: 'flex-end'`) so labels sit right above that clearance
// instead of at the top of the content area. The body::after pseudo-element
// in +html.tsx paints the safe-area strip with the tab bar's surface-1
// color so the visual continues to the physical bottom edge.
//
// The label size is also pinned below typography.sizes.xs (14 px): that size
// does not fit a standard tab bar next to a 24 pt icon on any platform, which
// is what clipped the labels in half natively as well.
// These overrides only apply where a home indicator actually exists. React
// Navigation reserves `paddingBottom: insets.bottom` (~34 px on iOS) inside the
// bar and anchors icon+label to the top of what is left, which on an iOS PWA
// leaves the labels floating high above a dead strip. Shrinking that padding to
// a 10 px clearance and anchoring content to the bottom fixes it there.
//
// Applying the same thing with NO bottom inset (desktop, or a phone without an
// indicator) instead eats into the default 49 px bar and squeezes the labels to
// ~3 px — so it is gated on insets.bottom rather than on web alone.
const isWeb = Platform.OS === 'web';
const TAB_LABEL_FONT_SIZE = 11;
const TAB_BAR_BOTTOM_CLEARANCE = 10;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const compactBottomInset = isWeb && insets.bottom > 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors['surface-1'],
          borderTopColor: colors['surface-2'],
          ...(compactBottomInset ? { paddingBottom: TAB_BAR_BOTTOM_CLEARANCE } : null),
        },
        tabBarItemStyle: compactBottomInset ? { justifyContent: 'flex-end' } : undefined,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors['text-secondary'],
        tabBarLabelStyle: {
          fontFamily: typography.fonts.sansMedium,
          fontSize: TAB_LABEL_FONT_SIZE,
        },
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
