import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../../storage/keys';
import { useAuthStore } from '../store/authStore';
import { useHistoryStore } from '../../history/store/historyStore';
import { shouldShowSignInPrompt } from '../lib/signInPromptGate';

export { SIGN_IN_PROMPT_MIN_SESSIONS, shouldShowSignInPrompt } from '../lib/signInPromptGate';

/**
 * Gate for the Home-tab sign-in nudge.
 *
 *   shouldShow  ⇔  anonymous AND ≥ N finished workouts AND not dismissed
 *
 * The dismissed bit is persisted in AsyncStorage and read once on
 * mount; a session's `dismiss()` call flips both memory and disk.
 * `reset()` clears it (used after sign-out so a fresh anonymous account
 * gets the prompt again).
 */
export function useSignInPrompt() {
  const status = useAuthStore((s) => s.status);
  const sessions = useHistoryStore((s) => s.sessions);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.SIGN_IN_PROMPT_DISMISSED);
        if (mounted) setDismissed(raw === 'true');
      } catch {
        if (mounted) setDismissed(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const dismiss = useCallback(async () => {
    setDismissed(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SIGN_IN_PROMPT_DISMISSED, 'true');
    } catch {
      // Non-fatal; the memory bit still hides the card for this session.
    }
  }, []);

  const reset = useCallback(async () => {
    setDismissed(false);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SIGN_IN_PROMPT_DISMISSED);
    } catch {
      // Non-fatal.
    }
  }, []);

  const finishedCount = sessions.filter((s) => s.completedAt !== null).length;
  const shouldShow = shouldShowSignInPrompt({
    authStatus: status,
    finishedCount,
    dismissed,
  });

  return { shouldShow, dismiss, reset, finishedCount };
}
