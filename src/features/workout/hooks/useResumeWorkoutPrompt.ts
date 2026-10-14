import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useWorkoutStore } from '../store/workoutStore';

const FOREGROUND_DEBOUNCE_MS = 300;

/**
 * Keeps the active-session store fresh: once on cold start, and again
 * whenever the app comes back to the foreground (another device may have
 * finished or discarded the workout in the meantime).
 *
 * This used to open a blocking "Resume or Discard?" dialog on every launch
 * with an unfinished workout. Those were the only two ways out — there was
 * no way to simply look at your history without first answering for the
 * workout. `ActiveWorkoutBanner` now offers both, permanently and without
 * blocking, so the modal was a toll booth in front of the whole app.
 */
export function useResumeWorkoutPrompt() {
  const loadActiveSession = useWorkoutStore((s) => s.loadActiveSession);
  const coldStartCheckedRef = useRef(false);

  useEffect(() => {
    if (coldStartCheckedRef.current) return;
    coldStartCheckedRef.current = true;
    void loadActiveSession();
  }, [loadActiveSession]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const appStateRef = { current: AppState.currentState };

    const handleAppState = (nextState: AppStateStatus) => {
      const wasBackground =
        appStateRef.current === 'inactive' || appStateRef.current === 'background';
      appStateRef.current = nextState;
      if (nextState !== 'active' || !wasBackground) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void loadActiveSession();
      }, FOREGROUND_DEBOUNCE_MS);
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => {
      subscription.remove();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [loadActiveSession]);
}
