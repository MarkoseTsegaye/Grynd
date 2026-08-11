import React from 'react';
import { View, Text } from 'react-native';
import { textRoles } from '../../../shared/theme/typography';
import type { SessionSummary } from '../lib/sessionSummary';

interface Props {
  summary: SessionSummary;
}

function Stat({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <View className={`flex-1 items-center py-2 ${last ? '' : 'border-r border-surface-1'}`}>
      <Text className={`text-text-primary ${textRoles.metricBold}`}>{value}</Text>
      <Text className={`text-text-disabled ${textRoles.caption}`} style={{ fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

/** At-a-glance session totals: what the workout actually amounted to. */
export function SessionSummaryStrip({ summary }: Props) {
  const stats: { value: string; label: string }[] = [
    { value: String(summary.setCount), label: summary.setCount === 1 ? 'set' : 'sets' },
    { value: summary.volumeText, label: summary.volumeLabel },
  ];
  if (summary.durationText) {
    stats.push({ value: summary.durationText, label: 'time' });
  }

  return (
    <View
      className="flex-row rounded-lg bg-surface-2 overflow-hidden my-2"
      accessibilityLabel={`${summary.setCountText}, ${summary.volumeText} ${summary.volumeLabel}${summary.durationText ? `, ${summary.durationText}` : ''}`}
    >
      {stats.map((stat, i) => (
        <Stat
          key={stat.label}
          value={stat.value}
          label={stat.label}
          last={i === stats.length - 1}
        />
      ))}
    </View>
  );
}
