import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import {
  useProgressChartData,
  ProgressSummary,
  VolumeLineChart,
} from '../src/features/progress';
import { Icon } from '../src/shared/components/Icon';
import { textRoles } from '../src/shared/theme/typography';

export default function ProgressScreen() {
  const chartData = useProgressChartData();

  if (chartData.status === 'loading') {
    return <View className="flex-1 bg-surface-0" />;
  }

  if (chartData.status === 'empty') {
    return (
      <View className="flex-1 bg-surface-0 items-center justify-center px-8">
        <Icon name="chart-line" size={48} color="text-disabled" />
        <Text className={`text-text-secondary ${textRoles.body} text-center mt-4`}>
          No workout volume yet.{'\n'}Finish a session with logged sets to see progress here.
        </Text>
      </View>
    );
  }

  const latestPoint =
    chartData.status === 'single'
      ? chartData.point
      : chartData.points[chartData.points.length - 1];
  const trend = chartData.status === 'ready' ? chartData.trend : null;
  const chartPoints = chartData.status === 'ready' ? chartData.points : [chartData.point];

  return (
    <ScrollView className="flex-1 bg-surface-0" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      <ProgressSummary trend={trend} latestPoint={latestPoint} />
      <Text className={`text-text-secondary ${textRoles.sectionLabel} mb-3`}>
        VOLUME OVER TIME
      </Text>
      <VolumeLineChart points={chartPoints} />
    </ScrollView>
  );
}
