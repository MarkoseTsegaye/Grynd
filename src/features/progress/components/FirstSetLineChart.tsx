import React, { useMemo, useState } from 'react';
import { View, Text, LayoutChangeEvent, Pressable } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors } from '../../../shared/theme/colors';
import { textRoles } from '../../../shared/theme/typography';
import { formatWeight, weightKgToDisplay } from '../../../shared/lib/weight';
import { getMetricDomain, getMetricValue, type ChartMetricId } from '../lib/chartMetric';
import type { FirstSetPoint } from '../lib/firstSetProgress';

const CHART_HEIGHT = 220;
const PADDING = { top: 20, right: 12, bottom: 28, left: 44 };
const MIN_RADIUS = 4;
const MAX_RADIUS = 9;

interface Props {
  points: FirstSetPoint[];
  metric: ChartMetricId;
  weightUnit: 'kg' | 'lbs';
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}

function shouldShowXLabel(index: number, total: number): boolean {
  if (total <= 6) return true;
  const step = Math.ceil(total / 6);
  return index % step === 0 || index === total - 1;
}

function radiusForReps(reps: number, minReps: number, maxReps: number): number {
  if (maxReps <= minReps) return (MIN_RADIUS + MAX_RADIUS) / 2;
  const t = (reps - minReps) / (maxReps - minReps);
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

export function FirstSetLineChart({
  points,
  metric,
  weightUnit,
  selectedIndex,
  onSelectIndex,
}: Props) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const chart = useMemo(() => {
    if (width <= 0 || points.length === 0) return null;

    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    // Snap in the unit the axis is labelled in — snapping in kg and then
    // converting produced axes like "176.4 / 198.4 / 220.5", which defeats the
    // point. A flat series still gets vertical room instead of a zero band.
    const values = points.map((point) =>
      weightKgToDisplay(getMetricValue(point, metric), weightUnit),
    );
    const { min: yMin, max: yMax, ticks } = getMetricDomain(values);
    const yRange = Math.max(yMax - yMin, 1);

    const minReps = Math.min(...points.map((p) => p.reps));
    const maxReps = Math.max(...points.map((p) => p.reps));

    const coords = points.map((point, index) => {
      const value = values[index];
      const x =
        points.length === 1
          ? PADDING.left + plotWidth / 2
          : PADDING.left + (index / (points.length - 1)) * plotWidth;
      const y = PADDING.top + plotHeight - ((value - yMin) / yRange) * plotHeight;
      return { ...point, value, x, y, r: radiusForReps(point.reps, minReps, maxReps) };
    });

    return {
      coords,
      polylinePoints: coords.map((point) => `${point.x},${point.y}`).join(' '),
      ticks,
      plotWidth,
      plotHeight,
      yMin,
      yRange,
    };
  }, [points, metric, weightUnit, width]);

  const metricLabel = metric === 'e1rm' ? 'estimated one rep max' : 'weight';

  const accessibilityLabel = useMemo(() => {
    const latest = points[points.length - 1];
    if (!latest) return 'First set progress chart';
    const latestValue = getMetricValue(latest, metric);
    return `First set ${metricLabel} across ${points.length} sessions. Latest ${formatWeight(latestValue, weightUnit)} ${weightUnit} from ${latest.reps} reps at ${formatWeight(latest.weightKg, weightUnit)} ${weightUnit} on ${latest.label}.`;
  }, [points, metric, metricLabel, weightUnit]);

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
            {chart.ticks.map((tick, index) => {
              const y =
                PADDING.top +
                chart.plotHeight -
                ((tick - chart.yMin) / chart.yRange) * chart.plotHeight;
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

            {chart.coords.map((point, index) => {
              const selected = index === selectedIndex;
              return (
                <Circle
                  key={`${point.sessionId}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={selected ? point.r + 2 : point.r}
                  fill={selected ? colors.accent : colors['accent-dim']}
                  stroke={selected ? colors['text-primary'] : 'transparent'}
                  strokeWidth={selected ? 2 : 0}
                  // Taps are handled by the Pressable overlays below: they give
                  // a 36pt target and a real accessibility label. Putting
                  // onPress here too made react-native-svg leak RN responder
                  // props onto DOM nodes, logging an error per point on web.
                />
              );
            })}
          </Svg>

          {/* Reps on the selected point — "dot size = reps" alone was
              undiscoverable and impossible to compare precisely. */}
          {chart.coords[selectedIndex] ? (
            <View
              className="absolute bg-surface-2 rounded px-1.5 py-0.5"
              pointerEvents="none"
              style={{
                left: Math.min(
                  Math.max(chart.coords[selectedIndex].x - 26, 2),
                  Math.max(width - 62, 2),
                ),
                top: Math.max(chart.coords[selectedIndex].y - 26, 2),
              }}
            >
              <Text
                className={`text-text-primary ${textRoles.metric}`}
                style={{ fontSize: 11 }}
                numberOfLines={1}
              >
                {chart.coords[selectedIndex].reps} reps
              </Text>
            </View>
          ) : null}

          {/* Larger hit targets over points */}
          {chart.coords.map((point, index) => (
            <Pressable
              key={`hit-${point.sessionId}-${index}`}
              onPress={() => onSelectIndex(index)}
              accessibilityRole="button"
              accessibilityLabel={`${point.label}: ${point.reps} reps at ${formatWeight(point.weightKg, weightUnit)} ${weightUnit}`}
              style={{
                position: 'absolute',
                left: point.x - 18,
                top: point.y - 18,
                width: 36,
                height: 36,
              }}
            />
          ))}

          <View
            className="absolute"
            style={{
              left: 0,
              top: PADDING.top,
              width: PADDING.left - 4,
              height: CHART_HEIGHT - PADDING.bottom - PADDING.top,
            }}
          >
            {[...chart.ticks].reverse().map((tick, index) => (
              <Text
                key={`y-${index}`}
                className={`text-text-secondary ${textRoles.caption} text-right`}
                style={{
                  position: 'absolute',
                  fontSize: 11,
                  top:
                    (index / Math.max(chart.ticks.length - 1, 1)) *
                    (CHART_HEIGHT - PADDING.bottom - PADDING.top - 12),
                  right: 0,
                }}
              >
                {tick}
              </Text>
            ))}
          </View>

          <View
            className="flex-row justify-between px-1"
            style={{
              marginLeft: PADDING.left - 8,
              marginRight: PADDING.right - 8,
              marginTop: -4,
            }}
          >
            {points.map((point, index) => (
              <View key={`${point.sessionId}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
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

          <Text className={`text-text-disabled ${textRoles.caption} mt-3 px-1`}>
            {metric === 'e1rm'
              ? 'Estimated 1RM from the first set — rises when reps rise at the same weight'
              : 'Weight on the first set · dot size = reps · tap a point to inspect'}
          </Text>
        </>
      ) : null}
    </View>
  );
}
