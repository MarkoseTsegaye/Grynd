import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors } from '../../../shared/theme/colors';
import { buildSparklinePoints, toPolylinePoints } from '../lib/sparkline';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  /** Muted when the series is trending down, so colour matches the chip. */
  tone?: 'up' | 'down' | 'flat';
}

/** Preview line for a list row — no axes, no labels, just the shape. */
export function Sparkline({ values, width = 64, height = 26, tone = 'up' }: Props) {
  const points = buildSparklinePoints(values, width, height);
  if (points.length === 0) return <View style={{ width, height }} />;

  const stroke =
    tone === 'down' ? colors.danger : tone === 'flat' ? colors['text-secondary'] : colors.accent;
  const last = points[points.length - 1];

  return (
    <View style={{ width, height }} pointerEvents="none">
      <Svg width={width} height={height}>
        {points.length > 1 ? (
          <Polyline
            points={toPolylinePoints(points)}
            fill="none"
            stroke={stroke}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        <Circle cx={last.x} cy={last.y} r={2.5} fill={stroke} />
      </Svg>
    </View>
  );
}
