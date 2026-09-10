import React, { useEffect, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pull as syncPull, useSyncStatusStore } from '../../storage/sync';
import { textRoles } from '../theme/typography';

/**
 * Debounce (ms) before showing the banner. A transient error during a
 * routine drain shouldn't flash a red bar for a heartbeat before things
 * recover — but a sustained failure should surface.
 */
const REVEAL_DELAY_MS = 4000;

/**
 * Floating banner surfaced when the sync engine has been in an
 * offline / error state for more than a few seconds. Mounted at the
 * root layout so every screen shows it consistently.
 *
 * Tapping "Retry" runs `pull()` — that's the cheapest way to test the
 * connection: it succeeds fast if the network / server / RLS all
 * cooperate, and if it succeeds the drain runs right after (well,
 * whenever the next mutation lands). The banner reads the status
 * store, so a recovery flips it away automatically.
 */
export function SyncErrorBanner() {
  const status = useSyncStatusStore((s) => s.status);
  const lastError = useSyncStatusStore((s) => s.lastError);
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== 'offline' && status !== 'error') {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (!visible) return null;

  const isOffline = status === 'offline';
  const label = isOffline
    ? "You're offline — changes will sync when you're back online."
    : lastError
      ? `Sync error: ${lastError}`
      : 'Sync error — tap Retry to try again.';

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: Platform.OS === 'web' ? Math.max(insets.top + 8, 12) : insets.top + 4,
        left: 12,
        right: 12,
        zIndex: 100,
      }}
    >
      <View
        className={`rounded-lg px-3 py-2 flex-row items-center ${
          isOffline ? 'bg-surface-2' : 'bg-danger'
        }`}
        style={{ shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
        accessibilityRole="alert"
      >
        <Text
          className={`flex-1 ${textRoles.caption} ${isOffline ? 'text-text-secondary' : 'text-surface-0'}`}
          numberOfLines={2}
        >
          {label}
        </Text>
        <TouchableOpacity
          onPress={() => void syncPull()}
          className="ml-2 px-2 py-1"
          accessibilityLabel="Retry sync"
          activeOpacity={0.7}
        >
          <Text className={`${textRoles.caption} ${isOffline ? 'text-accent' : 'text-surface-0'} font-bold`}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
