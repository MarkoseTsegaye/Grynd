export { useWeightStore } from './store/weightStore';
export type { WeightEntry } from './types';
export { LogWeightSheet } from './components/LogWeightSheet';
export { WeightLineChart } from './components/WeightLineChart';
export { WeightSummary } from './components/WeightSummary';
export { CaloriesOverlay } from './components/CaloriesOverlay';
export { useWeightChartData } from './hooks/useWeightChartData';
export {
  WEIGHT_RANGE_OPTIONS,
  buildWeightSeries,
  filterPointsByRange,
  getEntryForDateKey,
  getLatestWeightLbs,
  getWeeklyDelta,
  rollingAverageLbs,
} from './lib/weightStats';
export type { WeightRangeId, WeightPoint, WeeklyDelta } from './lib/weightStats';
