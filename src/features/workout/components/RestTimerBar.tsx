import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import type { RestTimerStatus } from '../hooks/useRestTimer';

function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface Props {
  status: RestTimerStatus;
  remainingMs: number;
  /** Remaining fraction (1 → 0) driving the background fill. */
  progress: number;
  onToggle: () => void;
  onAdjustPlus: () => void;
  onDismiss: () => void;
}

/**
 * Slim rest strip: 40px instead of the old ~100px card. The countdown drains
 * as a background fill so the time is readable peripherally, +15s stays one
 * tap, and the whole thing can be dismissed outright.
 */
export function RestTimerBar({
  status,
  remainingMs,
  progress,
  onToggle,
  onAdjustPlus,
  onDismiss,
}: Props) {
  const isComplete = status === 'complete';
  const isRunning = status === 'running';
  const displayTime = isComplete ? '0:00' : formatRemaining(remainingMs);

  return (
    <View
      className={`flex-row items-center rounded-lg overflow-hidden mb-2 ${isComplete ? 'bg-accent/15 border border-accent/40' : 'bg-surface-1'}`}
      style={{ height: 40 }}
    >
      {/* Countdown as a draining fill */}
      {!isComplete && (
        <View
          className="absolute left-0 top-0 bottom-0 bg-accent/10 border-r border-accent/40"
          style={{ width: `${Math.round(progress * 100)}%` }}
          pointerEvents="none"
        />
      )}

      <TouchableOpacity
        className="flex-row items-center gap-2 flex-1 h-full pl-3"
        onPress={onToggle}
        disabled={isComplete}
        accessibilityRole="button"
        accessibilityLabel={
          isComplete
            ? 'Rest complete'
            : `Rest ${displayTime} remaining, tap to ${isRunning ? 'pause' : 'resume'}`
        }
        activeOpacity={0.7}
      >
        <Icon name={isRunning ? 'timer-outline' : isComplete ? 'check-circle' : 'pause'} size={15} color="accent" />
        <Text className={`text-accent ${textRoles.metricBold}`}>{displayTime}</Text>
        <Text className={`${textRoles.caption} ${isComplete ? 'text-accent' : 'text-text-secondary'}`}>
          {isComplete ? 'rest done' : isRunning ? 'rest' : 'paused'}
        </Text>
      </TouchableOpacity>

      {!isComplete && (
        <TouchableOpacity
          className="bg-surface-2 rounded-md px-2 py-1 mr-1.5"
          onPress={onAdjustPlus}
          accessibilityRole="button"
          accessibilityLabel="Add 15 seconds to rest"
          activeOpacity={0.7}
        >
          <Text className={`text-text-secondary ${textRoles.caption}`} style={{ fontSize: 12 }}>
            +15s
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        className="h-full justify-center pr-3 pl-1"
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss rest timer"
        hitSlop={8}
        activeOpacity={0.7}
      >
        <Icon name="close" size={16} color={isComplete ? 'accent' : 'text-disabled'} />
      </TouchableOpacity>
    </View>
  );
}
