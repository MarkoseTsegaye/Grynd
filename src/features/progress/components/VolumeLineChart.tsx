import React, { useMemo, useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors } from '../../../shared/theme/colors';
import { textRoles } from '../../../shared/theme/typography';
import { formatVolumeAbbreviated, type VolumePoint } from '../lib/sessionVolume';

const CHART_HEIGHT = 220;
const PADDING = { top: 12, right: 12, bottom: 28, left: 44 };

interface Props {
  points: VolumePoint[];
}

function shouldShowXLabel(index: number, total: number): boolean {
  if (total <= 6) return true;
  const step = Math.ceil(total / 6);
  return index % step === 0 || index === total - 1;
}

export function VolumeLineChart({ points }: Props) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const chart = useMemo(() => {
    if (width <= 0 || points.length === 0) return null;

    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
    const maxVolume = Math.max(...points.map((point) => point.volume), 1);
    const minVolume = Math.min(...points.map((point) => point.volume));
    const volumeRange = Math.max(maxVolume - minVolume, 1);

    const coords = points.map((point, index) => {
      const x =
        points.length === 1
          ? PADDING.left + plotWidth / 2
          : PADDING.left + (index / (points.length - 1)) * plotWidth;
      const y =
        PADDING.top +
        plotHeight -
        ((point.volume - minVolume) / volumeRange) * plotHeight;
      return { ...point, x, y };
    });

    const polylinePoints = coords.map((point) => `${point.x},${point.y}`).join(' ');
    const yTicks = [minVolume, minVolume + volumeRange / 2, maxVolume];

    return { coords, polylinePoints, yTicks, plotWidth, plotHeight };
  }, [points, width]);

  const accessibilityLabel = useMemo(() => {
    const latest = points[points.length - 1];
    return `Workout volume chart with ${points.length} sessions. Latest volume ${formatVolumeAbbreviated(latest.volume)} kilogram reps on ${latest.label}.`;
  }, [points]);

  return (
    <View
      className="bg-surface-1 rounded-xl px-3 py-4 relative"
      onLayout={onLayout}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    >
      {width > 0 && chart ? (
        <>
          <Svg width={width} height={CHART_HEIGHT}>
            {chart.yTicks.map((tick, index) => {
              const y =
                PADDING.top +
                chart.plotHeight -
                ((tick - chart.yTicks[0]) / Math.max(chart.yTicks[2] - chart.yTicks[0], 1)) *
                  chart.plotHeight;
              return (
                <Line
                  key={`grid-${index}`}
                  x1={PADDING.left}
                  y1={y}
                  x2={PADDING.left + chart.plotWidth}
                  y2={y}
                  stroke={colors['surface-2']}
                  strokeWidth={1}
                />
              );
            })}

            {points.length > 1 ? (
              <Polyline
                points={chart.polylinePoints}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {chart.coords.map((point, index) => (
              <Circle
                key={`${point.date}-${index}`}
                cx={point.x}
                cy={point.y}
                r={4}
                fill={colors.accent}
              />
            ))}
          </Svg>

          <View
            className="absolute"
            style={{ left: 0, top: PADDING.top, width: PADDING.left - 4, height: CHART_HEIGHT - PADDING.bottom - PADDING.top }}
          >
            {[...chart.yTicks].reverse().map((tick, index) => (
              <Text
                key={`y-${index}`}
                className={`text-text-secondary ${textRoles.caption} text-right`}
                style={{
                  position: 'absolute',
                  top: (index / Math.max(chart.yTicks.length - 1, 1)) * (CHART_HEIGHT - PADDING.bottom - PADDING.top - 12),
                  right: 0,
                }}
              >
                {formatVolumeAbbreviated(tick)}
              </Text>
            ))}
          </View>

          <View
            className="flex-row justify-between px-1"
            style={{ marginLeft: PADDING.left - 8, marginRight: PADDING.right - 8, marginTop: -4 }}
          >
            {points.map((point, index) => (
              <View key={`${point.date}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
                {shouldShowXLabel(index, points.length) ? (
                  <Text className={`text-text-secondary ${textRoles.caption}`} numberOfLines={1}>
                    {point.label}
                  </Text>
                ) : (
                  <Text className={`text-text-secondary ${textRoles.caption}`}>{' '}</Text>
                )}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
