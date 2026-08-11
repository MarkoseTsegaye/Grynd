import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export type RestTimerStatus = 'idle' | 'running' | 'paused' | 'complete';

export function useRestTimer(onComplete?: () => void) {
  const [status, setStatus] = useState<RestTimerStatus>('idle');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedRemainingMs, setPausedRemainingMs] = useState(0);
  // Tracked so the slim bar can render remaining time as a background fill.
  const [totalMs, setTotalMs] = useState(0);
  const [, setTick] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const getRemainingMs = useCallback((): number => {
    if (status === 'running' && endsAt !== null) {
      return Math.max(0, endsAt - Date.now());
    }
    if (status === 'paused') {
      return pausedRemainingMs;
    }
    return 0;
  }, [status, endsAt, pausedRemainingMs]);

  const complete = useCallback(() => {
    setStatus('complete');
    setEndsAt(null);
    setPausedRemainingMs(0);
    onCompleteRef.current?.();
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setEndsAt(null);
    setPausedRemainingMs(0);
    setTotalMs(0);
  }, []);

  const dismissComplete = useCallback(() => {
    if (status === 'complete') {
      reset();
    }
  }, [status, reset]);

  const start = useCallback((seconds: number) => {
    setEndsAt(Date.now() + seconds * 1000);
    setPausedRemainingMs(0);
    setTotalMs(seconds * 1000);
    setStatus('running');
    setTick((t) => t + 1);
  }, []);

  const pause = useCallback(() => {
    if (status !== 'running' || endsAt === null) return;
    const remaining = Math.max(0, endsAt - Date.now());
    if (remaining <= 0) {
      complete();
      return;
    }
    setPausedRemainingMs(remaining);
    setEndsAt(null);
    setStatus('paused');
  }, [status, endsAt, complete]);

  const resume = useCallback(() => {
    if (status !== 'paused' || pausedRemainingMs <= 0) return;
    setEndsAt(Date.now() + pausedRemainingMs);
    setStatus('running');
    setTick((t) => t + 1);
  }, [status, pausedRemainingMs]);

  const adjustSeconds = useCallback(
    (delta: number) => {
      if (status !== 'running' && status !== 'paused') return;

      const remaining = getRemainingMs();
      const next = Math.max(0, remaining + delta * 1000);

      if (next === 0) {
        complete();
        return;
      }

      if (status === 'running') {
        setEndsAt(Date.now() + next);
      } else {
        setPausedRemainingMs(next);
      }
      // Grow the denominator when the user adds time, so the fill never
      // overflows past full after a +15s.
      setTotalMs((prev) => Math.max(prev, next));
      setTick((t) => t + 1);
    },
    [status, getRemainingMs, complete],
  );

  useEffect(() => {
    if (status !== 'running' || endsAt === null) return;

    const check = () => {
      const remaining = Math.max(0, endsAt - Date.now());
      if (remaining <= 0) {
        complete();
      } else {
        setTick((t) => t + 1);
      }
    };

    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [status, endsAt, complete]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || status !== 'running' || endsAt === null) return;
      const remaining = Math.max(0, endsAt - Date.now());
      if (remaining <= 0) {
        complete();
      } else {
        setTick((t) => t + 1);
      }
    });
    return () => subscription.remove();
  }, [status, endsAt, complete]);

  const remainingMs = getRemainingMs();
  const isVisible = status !== 'idle';
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;

  return {
    status,
    remainingMs,
    progress,
    isVisible,
    start,
    pause,
    resume,
    adjustSeconds,
    reset,
    dismissComplete,
  };
}
