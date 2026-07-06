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
  onStart: () => void;
  onStop: () => void;
  onAdjustMinus: () => void;
  onAdjustPlus: () => void;
  onDismissComplete: () => void;
}

export function RestTimerBar({
  status,
  remainingMs,
  onStart,
  onStop,
  onAdjustMinus,
  onAdjustPlus,
  onDismissComplete,
}: Props) {
  const isComplete = status === 'complete';
  const isRunning = status === 'running';
  const displayTime = isComplete ? '0:00' : formatRemaining(remainingMs);

  return (
    <View className="bg-surface-1 border border-surface-2 rounded-lg px-4 py-3 mt-4 mb-1">
      <View className="flex-row items-center justify-between mb-3">
        <Text className={`text-text-secondary ${textRoles.caption}`}>Rest</Text>
        {isComplete ? (
          <TouchableOpacity
            onPress={onDismissComplete}
            accessibilityLabel="Dismiss rest complete"
            activeOpacity={0.7}
          >
            <Text className={`text-accent ${textRoles.caption}`}>Done</Text>
          </TouchableOpacity>
        ) : (
          <Text
            className={`text-text-primary ${textRoles.metricLarge}`}
            accessibilityLabel={`Rest time remaining, ${displayTime}`}
          >
            {displayTime}
          </Text>
        )}
      </View>

      {isComplete ? (
        <Text
          className={`text-accent ${textRoles.body} text-center py-1`}
          accessibilityLabel="Rest complete"
        >
          Rest complete
        </Text>
      ) : (
        <View className="flex-row items-center justify-between gap-2">
          <TouchableOpacity
            className="bg-surface-2 rounded-lg px-3 py-2.5 min-w-[56px] items-center"
            onPress={onAdjustMinus}
            accessibilityLabel="Subtract 15 seconds from rest"
            activeOpacity={0.7}
          >
            <Text className={`text-text-primary ${textRoles.buttonLabelSmall}`}>−15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`rounded-lg px-4 py-2.5 flex-row items-center gap-1.5 ${isRunning ? 'bg-surface-2' : 'bg-accent'}`}
            onPress={isRunning ? onStop : onStart}
            accessibilityLabel={isRunning ? 'Stop rest timer' : 'Start rest timer'}
            activeOpacity={0.7}
          >
            <Icon
              name={isRunning ? 'pause' : 'play'}
              size={18}
              color={isRunning ? 'text-primary' : 'surface-0'}
            />
            <Text
              className={`${textRoles.buttonLabelSmall} ${isRunning ? 'text-text-primary' : 'text-surface-0'}`}
            >
              {isRunning ? 'Stop' : 'Start'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-surface-2 rounded-lg px-3 py-2.5 min-w-[56px] items-center"
            onPress={onAdjustPlus}
            accessibilityLabel="Add 15 seconds to rest"
            activeOpacity={0.7}
          >
            <Text className={`text-text-primary ${textRoles.buttonLabelSmall}`}>+15s</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
