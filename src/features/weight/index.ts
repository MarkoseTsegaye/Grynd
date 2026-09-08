export { useWeightStore } from './store/weightStore';
export type { WeightEntry } from './types';
export { LogWeightSheet } from './components/LogWeightSheet';
export { WeightLineChart } from './components/WeightLineChart';
export { WeightSummary } from './components/WeightSummary';
export { WeeklyAveragesList } from './components/WeeklyAveragesList';
export { useWeightChartData } from './hooks/useWeightChartData';
export {
  WEIGHT_RANGE_OPTIONS,
  buildWeightSeries,
  filterPointsByRange,
  getEntryForDateKey,
  getLatestWeightLbs,
  getWeeklyAverages,
  getWeeklyDelta,
  rollingAverageLbs,
} from './lib/weightStats';
export type {
  WeeklyAverage,
  WeeklyDelta,
  WeightPoint,
  WeightRangeId,
} from './lib/weightStats';
