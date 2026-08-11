import { useEffect, useRef, useCallback } from 'react';
import { showDialog } from '../../../shared/lib/dialog';
import { AppState, type AppStateStatus } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useWorkoutStore } from '../store/workoutStore';
import {
  isWorkoutRoute,
  shouldPromptResumeSession,
  shouldSuppressForegroundPrompt,
} from '../lib/workoutRoute';

const FOREGROUND_DEBOUNCE_MS = 300;

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
      showDialog(
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
      if (shouldPromptResumeSession(s, pathnameRef.current)) {
        coldStartPromptAtRef.current = Date.now();
        showPrompt(s!.splitId, s!.splitName);
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

        void loadActiveSession().then(() => {
          if (shouldSuppressForegroundPrompt(coldStartPromptAtRef.current, Date.now())) {
            return;
          }

          const s = useWorkoutStore.getState().session;
          if (shouldPromptResumeSession(s, pathnameRef.current)) {
            showPrompt(s!.splitId, s!.splitName);
          }
        });
      }, FOREGROUND_DEBOUNCE_MS);
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => {
      subscription.remove();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [loadActiveSession, showPrompt]);
}
