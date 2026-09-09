import React from 'react';
import { View } from 'react-native';
import { useSyncStatusStore } from '../../storage/sync/status';

const COLOR_BY_STATUS: Record<string, string> = {
  idle: '#4ADE80', // green
  syncing: '#FBBF24', // amber
  offline: '#8A8580', // gray
  error: '#FF4C4C', // danger
  unconfigured: '#3D3B38', // muted
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
        backgroundColor: COLOR_BY_STATUS[status] ?? COLOR_BY_STATUS.idle,
      }}
      accessibilityLabel={`Sync status: ${status}`}
    />
  );
}
