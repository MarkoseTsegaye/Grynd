import React from 'react';
import { View } from 'react-native';
import { useSyncStatusStore } from '../../storage/sync/status';
import { colors } from '../theme/colors';
import type { SyncStatus } from '../../storage/sync/status';

const COLOR_BY_STATUS: Record<SyncStatus, string> = {
  idle: colors.success,
  syncing: colors.warning,
  offline: colors['text-secondary'],
  error: colors.danger,
  unconfigured: colors['text-disabled'],
};

/**
 * A small colored dot that mirrors `useSyncStatusStore.status`. Meant to
 * sit next to the Account row in Settings; a hint of activity without a
 * modal.
 */
export function SyncStatusDot({ size = 8 }: { size?: number }) {
  const status = useSyncStatusStore((s) => s.status);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLOR_BY_STATUS[status] ?? colors.success,
      }}
      accessibilityLabel={`Sync status: ${status}`}
    />
  );
}
