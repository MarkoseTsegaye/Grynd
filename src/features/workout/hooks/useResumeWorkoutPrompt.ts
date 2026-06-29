import { useEffect, useRef, useCallback } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useWorkoutStore } from '../store/workoutStore';

const FOREGROUND_DEBOUNCE_MS = 300;
const COLD_START_GUARD_MS = 2000;

function isWorkoutRoute(pathname: string): boolean {
  return pathname.startsWith('/workout/');
}

export function useResumeWorkoutPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const { loadActiveSession, abandonWorkout } = useWorkoutStore();
  const alertVisibleRef = useRef(false);
  const coldStartCheckedRef = useRef(false);
  const coldStartPromptAtRef = useRef<number | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const showPrompt = useCallback(
    (splitId: string, splitName: string) => {
      if (alertVisibleRef.current) return;
      if (isWorkoutRoute(pathnameRef.current)) return;

      alertVisibleRef.current = true;
      Alert.alert(
        'Resume Workout?',
        `You have an unfinished ${splitName} workout.`,
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              alertVisibleRef.current = false;
              void abandonWorkout();
            },
          },
          {
            text: 'Resume',
            style: 'default',
            onPress: () => {
              alertVisibleRef.current = false;
              router.push(`/workout/${splitId}`);
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            alertVisibleRef.current = false;
          },
        },
      );
    },
    [abandonWorkout, router],
  );

  useEffect(() => {
    if (coldStartCheckedRef.current) return;
    coldStartCheckedRef.current = true;

    void loadActiveSession().then(() => {
      const s = useWorkoutStore.getState().session;
      if (s) {
        coldStartPromptAtRef.current = Date.now();
        showPrompt(s.splitId, s.splitName);
      }
    });
  }, [loadActiveSession, showPrompt]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const appStateRef = { current: AppState.currentState };

    const handleAppState = (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current === 'inactive' || appStateRef.current === 'background';
      appStateRef.current = nextState;

      if (nextState !== 'active' || !wasBackground) return;
      if (isWorkoutRoute(pathnameRef.current)) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;

        const coldStartAt = coldStartPromptAtRef.current;
        if (coldStartAt !== null && Date.now() - coldStartAt < COLD_START_GUARD_MS) {
          return;
        }

        const s = useWorkoutStore.getState().session;
        if (!s) return;
        showPrompt(s.splitId, s.splitName);
      }, FOREGROUND_DEBOUNCE_MS);
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => {
      subscription.remove();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [showPrompt]);
}
