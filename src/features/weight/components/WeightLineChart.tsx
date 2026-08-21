import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Text, View, Pressable } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors } from '../../../shared/theme/colors';
import { textRoles } from '../../../shared/theme/typography';
import type { WeightPoint } from '../lib/weightStats';

/**
 * Body-weight line chart. Cloned from VolumeLineChart with two differences:
 * points are pressable so a tap selects a day (for the edit-past-entry flow),
 * and the y-axis formats as pounds. The min/max normalization, padding, and
 * x-label thinning are intentionally identical to keep the two feature charts
 * visually consistent.
 */

const CHART_HEIGHT = 220;
const PADDING = { top: 12, right: 12, bottom: 28, left: 44 };
const FLAT_SERIES_PAD_LBS = 0.5;

interface Props {
  points: WeightPoint[];
  selectedId?: string | null;
  onSelect?: (point: WeightPoint) => void;
}

function shouldShowXLabel(index: number, total: number): boolean {
  if (total <= 6) return true;
  const step = Math.ceil(total / 6);
  return index % step === 0 || index === total - 1;
}

function formatWeight(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} lb` : `${rounded.toFixed(1)} lb`;
}

export function WeightLineChart({ points, selectedId, onSelect }: Props) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const chart = useMemo(() => {
    if (width <= 0 || points.length === 0) return null;

    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const weights = points.map((p) => p.weightLbs);
    const rawMax = Math.max(...weights);
    const rawMin = Math.min(...weights);
    // For a perfectly flat series, pad ±0.5 lb so the line doesn't collapse to the
    // top of the plot area.
    const min = rawMax === rawMin ? rawMin - FLAT_SERIES_PAD_LBS : rawMin;
    const max = rawMax === rawMin ? rawMax + FLAT_SERIES_PAD_LBS : rawMax;
    const range = Math.max(max - min, 1);

    const coords = points.map((point, index) => {
      const x =
        points.length === 1
          ? PADDING.left + plotWidth / 2
          : PADDING.left + (index / (points.length - 1)) * plotWidth;
      const y =
        PADDING.top +
        plotHeight -
        ((point.weightLbs - min) / range) * plotHeight;
      return { ...point, x, y };
    });

    const polylinePoints = coords.map((point) => `${point.x},${point.y}`).join(' ');
    const yTicks = [min, min + range / 2, max];

    return { coords, polylinePoints, yTicks, plotWidth, plotHeight };
  }, [points, width]);

  const accessibilityLabel = useMemo(() => {
    if (points.length === 0) return 'Body weight chart (no data).';
    const latest = points[points.length - 1];
    return `Body weight chart with ${points.length} entries. Latest ${formatWeight(latest.weightLbs)} on ${latest.label}.`;
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

            {chart.coords.map((point) => {
              const isSelected = selectedId != null && point.id === selectedId;
              return (
                <React.Fragment key={point.id}>
                  {isSelected ? (
                    <Circle
                      cx={point.x}
                      cy={point.y}
                      r={7}
                      fill="none"
                      stroke={colors['text-primary']}
                      strokeWidth={1.5}
                    />
                  ) : null}
                  <Circle cx={point.x} cy={point.y} r={4} fill={colors.accent} />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Y-axis tick labels */}
          <View
            className="absolute"
            style={{
              left: 0,
              top: PADDING.top,
              width: PADDING.left - 4,
              height: CHART_HEIGHT - PADDING.bottom - PADDING.top,
            }}
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
                {formatWeight(tick)}
              </Text>
            ))}
          </View>

          {/* X-axis labels + invisible tap targets for point selection */}
          <View
            className="flex-row justify-between px-1"
            style={{ marginLeft: PADDING.left - 8, marginRight: PADDING.right - 8, marginTop: -4 }}
          >
            {points.map((point, index) => (
              <Pressable
                key={point.id}
                onPress={onSelect ? () => onSelect(point) : undefined}
                accessibilityRole={onSelect ? 'button' : undefined}
                accessibilityLabel={
                  onSelect ? `Edit ${formatWeight(point.weightLbs)} on ${point.label}` : undefined
                }
                hitSlop={6}
                style={{ flex: 1, alignItems: 'center' }}
              >
                {shouldShowXLabel(index, points.length) ? (
                  <Text className={`text-text-secondary ${textRoles.caption}`} numberOfLines={1}>
                    {point.label}
                  </Text>
                ) : (
                  <Text className={`text-text-secondary ${textRoles.caption}`}>{' '}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
