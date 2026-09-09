/**
 * Threshold before the soft sign-in prompt appears on Home. Chosen so
 * a user who bounces after logging one workout never sees the nudge;
 * three finished workouts is a real signal they're going to stick.
 */
export const SIGN_IN_PROMPT_MIN_SESSIONS = 3;

/**
 * Pure gating rule for the sign-in nudge. Lives in a React-free file
 * so vitest can import it without pulling in react-native.
 *
 * `dismissed = null` means "still loading" — hide until we know.
 */
export function shouldShowSignInPrompt(input: {
  authStatus: string;
  finishedCount: number;
  dismissed: boolean | null;
}): boolean {
  return (
    input.authStatus === 'anonymous' &&
    input.finishedCount >= SIGN_IN_PROMPT_MIN_SESSIONS &&
    input.dismissed === false
  );
}
