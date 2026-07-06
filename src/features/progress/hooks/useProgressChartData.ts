import { useMemo } from 'react';
import { useHistory } from '../../history';
import {
  buildVolumeSeries,
  getLatestVolumeTrend,
  type VolumePoint,
  type VolumeTrend,
} from '../lib/sessionVolume';

export type ProgressChartState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'single'; point: VolumePoint }
  | { status: 'ready'; points: VolumePoint[]; trend: VolumeTrend };

export function useProgressChartData(): ProgressChartState {
  const { sessions, isLoaded } = useHistory();

  return useMemo(() => {
    if (!isLoaded) return { status: 'loading' };

    const points = buildVolumeSeries(sessions);

    if (points.length === 0) return { status: 'empty' };
    if (points.length === 1) return { status: 'single', point: points[0] };

    const trend = getLatestVolumeTrend(points);
    if (!trend) return { status: 'single', point: points[0] };

    return { status: 'ready', points, trend };
  }, [isLoaded, sessions]);
}
