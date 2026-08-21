import { useEffect, useMemo, useState } from 'react';
import { useWeightStore } from '../store/weightStore';
import {
  buildWeightSeries,
  filterPointsByRange,
  getLatestWeightLbs,
  getWeeklyDelta,
  rollingAverageLbs,
  type WeeklyDelta,
  type WeightPoint,
  type WeightRangeId,
} from '../lib/weightStats';
import type { WeightEntry } from '../types';

export type WeightChartState =
  | { status: 'loading' }
  | {
      status: 'empty';
      entries: WeightEntry[];
      rangeId: WeightRangeId;
      setRangeId: (id: WeightRangeId) => void;
    }
  | {
      status: 'ready';
      entries: WeightEntry[];
      /** All points (unfiltered — for latest / delta / rolling avg). */
      allPoints: WeightPoint[];
      /** Points filtered to the current range (for the chart display). */
      visiblePoints: WeightPoint[];
      currentLbs: number | null;
      rolling7dayAvgLbs: number | null;
      weeklyDelta: WeeklyDelta | null;
      rangeId: WeightRangeId;
      setRangeId: (id: WeightRangeId) => void;
    };

export function useWeightChartData(): WeightChartState {
  const entries = useWeightStore((s) => s.entries);
  const isLoaded = useWeightStore((s) => s.isLoaded);
  const loadEntries = useWeightStore((s) => s.loadEntries);
  const [rangeId, setRangeId] = useState<WeightRangeId>('1m');

  useEffect(() => {
    if (!isLoaded) void loadEntries();
  }, [isLoaded, loadEntries]);

  return useMemo(() => {
    if (!isLoaded) return { status: 'loading' };

    if (entries.length === 0) {
      return { status: 'empty', entries, rangeId, setRangeId };
    }

    const allPoints = buildWeightSeries(entries);
    const visiblePoints = filterPointsByRange(allPoints, rangeId);

    return {
      status: 'ready',
      entries,
      allPoints,
      visiblePoints,
      currentLbs: getLatestWeightLbs(entries),
      rolling7dayAvgLbs: rollingAverageLbs(entries, Date.now(), 7),
      weeklyDelta: getWeeklyDelta(entries),
      rangeId,
      setRangeId,
    };
  }, [entries, isLoaded, rangeId]);
}
