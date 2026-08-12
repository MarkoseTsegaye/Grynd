import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';
import { Sparkline } from './Sparkline';
import { formatTrendPercent, type SeriesTrend } from '../lib/sparkline';

interface Props {
  name: string;
  /** Est. 1RM per session, oldest first. Empty when never logged. */
  values: number[];
  trend: SeriesTrend | null;
  onPress: () => void;
}

/**
 * A progress list row that previews the trend instead of looking identical to
 * the Splits list. Without this the screen gives no reason to tap any
 * particular row — you had to open each one to find out if anything moved.
 */
export function ExerciseProgressRow({ name, values, trend, onPress }: Props) {
  const tone = trend?.direction ?? 'flat';
  const hasSeries = values.length > 1;

  const accessibilityLabel = trend
    ? `${name}, ${formatTrendPercent(trend)} over ${values.length} sessions. View progress.`
    : values.length === 1
      ? `${name}, one session logged. View progress.`
      : `${name}, no sessions logged yet. View progress.`;

  return (
    <TouchableOpacity
      className="flex-row items-center bg-surface-1 rounded-lg px-4 py-3 mb-3 gap-3"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Text className={`text-text-primary ${textRoles.listItemTitle} flex-1`} numberOfLines={1}>
        {name}
      </Text>

      {hasSeries ? (
        <Sparkline values={values} tone={tone} />
      ) : (
        <Text className={`text-text-disabled ${textRoles.caption}`}>
          {values.length === 1 ? '1 session' : 'no data'}
        </Text>
      )}

      {trend ? (
        <View
          className={`flex-row items-center rounded-md pl-0.5 pr-1.5 py-0.5 ${
            trend.direction === 'up'
              ? 'bg-success/15'
              : trend.direction === 'down'
                ? 'bg-danger/15'
                : 'bg-surface-2'
          }`}
          style={{ minWidth: 52, justifyContent: 'center' }}
        >
          {trend.direction !== 'flat' && (
            <Icon
              name={trend.direction === 'up' ? 'menu-up' : 'menu-down'}
              size={14}
              color={trend.direction === 'up' ? 'success' : 'danger'}
            />
          )}
          <Text
            className={`${textRoles.metricBold} ${
              trend.direction === 'up'
                ? 'text-success'
                : trend.direction === 'down'
                  ? 'text-danger'
                  : 'text-text-secondary'
            }`}
            style={{ fontSize: 12 }}
          >
            {formatTrendPercent(trend)}
          </Text>
        </View>
      ) : (
        <View style={{ minWidth: 52 }} />
      )}

      <Icon name="chevron-right" size={20} color="text-disabled" />
    </TouchableOpacity>
  );
}
