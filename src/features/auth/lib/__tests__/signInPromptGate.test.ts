import { describe, expect, it } from 'vitest';
import {
  SIGN_IN_PROMPT_MIN_SESSIONS,
  shouldShowSignInPrompt,
} from '../signInPromptGate';

describe('shouldShowSignInPrompt', () => {
  it('hides while the dismissed bit is still loading', () => {
    expect(
      shouldShowSignInPrompt({
        authStatus: 'anonymous',
        finishedCount: 10,
        dismissed: null,
      }),
    ).toBe(false);
  });

  it('hides when the user is already identified', () => {
    expect(
      shouldShowSignInPrompt({
        authStatus: 'identified',
        finishedCount: 10,
        dismissed: false,
      }),
    ).toBe(false);
  });

  it('hides for unconfigured / bootstrapping / error states', () => {
    for (const s of ['idle', 'bootstrapping', 'unconfigured', 'error']) {
      expect(
        shouldShowSignInPrompt({
          authStatus: s,
          finishedCount: 10,
          dismissed: false,
        }),
      ).toBe(false);
    }
  });

  it('hides below the threshold', () => {
    expect(
      shouldShowSignInPrompt({
        authStatus: 'anonymous',
        finishedCount: SIGN_IN_PROMPT_MIN_SESSIONS - 1,
        dismissed: false,
      }),
    ).toBe(false);
  });

  it('shows at exactly the threshold when anonymous and not dismissed', () => {
    expect(
      shouldShowSignInPrompt({
        authStatus: 'anonymous',
        finishedCount: SIGN_IN_PROMPT_MIN_SESSIONS,
        dismissed: false,
      }),
    ).toBe(true);
  });

  it('shows above the threshold', () => {
    expect(
      shouldShowSignInPrompt({
        authStatus: 'anonymous',
        finishedCount: SIGN_IN_PROMPT_MIN_SESSIONS + 5,
        dismissed: false,
      }),
    ).toBe(true);
  });

  it('hides once dismissed even when everything else qualifies', () => {
    expect(
      shouldShowSignInPrompt({
        authStatus: 'anonymous',
        finishedCount: 10,
        dismissed: true,
      }),
    ).toBe(false);
  });
});

describe('SIGN_IN_PROMPT_MIN_SESSIONS', () => {
  it('is set to 3 workouts', () => {
    // Codified so a future tweak surfaces in a PR diff rather than a
    // silent change to the prompt cadence.
    expect(SIGN_IN_PROMPT_MIN_SESSIONS).toBe(3);
  });
});
