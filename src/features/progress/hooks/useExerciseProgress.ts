import { useEffect, useMemo, useState } from 'react';
import { useHistory } from '../../history';
import { useSplitsStore } from '../../splits';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import {
  buildFirstSetSeries,
  getFirstSetTrend,
  isPersonalBest,
  type ProgressRangeId,
} from '../lib/firstSetProgress';

export function useExerciseProgress(exerciseId: string) {
  const { sessions, isLoaded: historyLoaded } = useHistory();
  const { exercises, splits, isLoaded: splitsLoaded, loadData } = useSplitsStore();
  const { weightUnit, isLoaded: prefsLoaded, loadPrefs } = usePrefsStore();
  const [rangeId, setRangeId] = useState<ProgressRangeId>('2m');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!splitsLoaded) void loadData();
  }, [splitsLoaded, loadData]);

  useEffect(() => {
    if (!prefsLoaded) void loadPrefs();
  }, [prefsLoaded, loadPrefs]);

  const exercise = useMemo(
    () => exercises.find((e) => e.id === exerciseId) ?? null,
    [exercises, exerciseId],
  );

  const points = useMemo(
    () => buildFirstSetSeries(sessions, exerciseId, rangeId),
    [sessions, exerciseId, rangeId],
  );

  useEffect(() => {
    setSelectedIndex(Math.max(points.length - 1, 0));
  }, [points]);

  const selectedPoint = points[selectedIndex] ?? null;
  const trend = useMemo(() => getFirstSetTrend(points), [points]);
  const personalBest = useMemo(() => isPersonalBest(points), [points]);

  const splitName = useMemo(() => {
    const split = splits.find((s) => s.exerciseIds.includes(exerciseId));
    return split?.name ?? null;
  }, [splits, exerciseId]);

  const isLoaded = historyLoaded && splitsLoaded && prefsLoaded;

  return {
    isLoaded,
    exercise,
    splitName,
    points,
    selectedIndex,
    setSelectedIndex,
    selectedPoint,
    trend,
    personalBest,
    rangeId,
    setRangeId,
    weightUnit,
  };
}
