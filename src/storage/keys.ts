export const STORAGE_KEYS = {
  SPLITS: 'splits:all',
  EXERCISES: 'exercises:all',
  SESSIONS: 'sessions:all',
  ACTIVE_SESSION: 'sessions:active',
  WORKOUT_CYCLE: 'cycle:workout',
  WEIGHT_ENTRIES: 'weight:all',
  WEIGHT_UNIT: 'prefs:weightUnit',
  AUTO_ADVANCE_CYCLE: 'prefs:autoAdvanceCycle',
  DEFAULT_REST_SECONDS: 'prefs:defaultRestSeconds',
  HAS_SEEN_SWIPE_HINT: 'prefs:hasSeenSwipeHint',
  /**
   * Single timestamp stamped on every prefs mutation. Prefs live under
   * three separate AsyncStorage keys today (weight unit, auto-advance,
   * default rest); the sync layer treats them as one row and needs one
   * `updated_at` to LWW-compare against the server row.
   */
  PREFS_UPDATED_AT: 'prefs:updatedAt',
  /**
   * ms of the last mutation to the workout cycle. The cycle itself is
   * stored under WORKOUT_CYCLE — this bookmark is kept alongside so
   * older on-device cycles (written before phase 3) can be backfilled
   * cleanly.
   */
  CYCLE_UPDATED_AT: 'cycle:updatedAt',
  /**
   * Persisted "user dismissed the sign-in prompt" bit for the Home tab
   * soft prompt. Once dismissed it stays dismissed until explicit
   * account state changes.
   */
  SIGN_IN_PROMPT_DISMISSED: 'auth:signInPromptDismissed',
} as const;
