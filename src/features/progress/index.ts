export { useProgressChartData } from './hooks/useProgressChartData';
export { useExerciseProgress } from './hooks/useExerciseProgress';
export { useExerciseMomentum } from './hooks/useExerciseMomentum';
export { rankExerciseMomentum } from './lib/exerciseMomentum';
export type { ExerciseMomentum, MomentumRow } from './lib/exerciseMomentum';
export { ExerciseProgressRow } from './components/ExerciseProgressRow';
export { Sparkline } from './components/Sparkline';
export { ProgressSummary } from './components/ProgressSummary';
export { VolumeLineChart } from './components/VolumeLineChart';
export { FirstSetLineChart } from './components/FirstSetLineChart';
export { FirstSetSummary } from './components/FirstSetSummary';
export type { ProgressChartState } from './hooks/useProgressChartData';
export {
  buildFirstSetSeries,
  getFirstSetTrend,
  PROGRESS_RANGE_OPTIONS,
} from './lib/firstSetProgress';
