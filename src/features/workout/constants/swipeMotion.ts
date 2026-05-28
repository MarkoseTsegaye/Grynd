import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export const SWIPE_THRESHOLD = 80;
export const SWIPE_VELOCITY_THRESHOLD = 500;
export const DRAG_TRACKING_FACTOR = 0.9;
export const MAX_DRAG_FRACTION = 0.35;
export const RUBBER_BAND_RESISTANCE = 0.28;

export const COMMIT_EXIT_TIMING: WithTimingConfig = { duration: 150 };
export const COMMIT_ENTER_TIMING: WithTimingConfig = { duration: 150 };
export const CANCEL_SPRING: WithSpringConfig = {
  damping: 22,
  stiffness: 380,
  mass: 0.8,
};

function rubberBandResistance(translationX: number, maxDrag: number): number {
  'worklet';
  const abs = Math.abs(translationX);
  const resisted = maxDrag * (1 - Math.exp(-abs * RUBBER_BAND_RESISTANCE / maxDrag));
  return Math.sign(translationX) * Math.min(resisted, maxDrag);
}

export function clampDragTranslation(
  translationX: number,
  canGoPrev: boolean,
  screenWidth: number,
): number {
  'worklet';
  const maxDrag = screenWidth * MAX_DRAG_FRACTION;

  if (translationX > 0 && !canGoPrev) {
    return rubberBandResistance(translationX, maxDrag * 0.45);
  }

  const tracked = translationX * DRAG_TRACKING_FACTOR;
  return Math.max(-maxDrag, Math.min(maxDrag, tracked));
}
