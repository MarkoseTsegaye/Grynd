# Pause / leave active workout with Home resume and app-return prompt
## Run 2026-06-29T02:27:15.089Z

Artifacts: `tickets/20260628-222034`

### Ticket
## Title

Pause / leave active workout with Home resume and app-return prompt

## Context

Grynd already persists an in-progress workout via `ACTIVE_SESSION` (`src/storage/adapters/sessions.ts`) and the Zustand `useWorkoutStore`. The workout screen bootstrap in `app/workout/[splitId].tsx` can resume a matching session, and Home (`app/(tabs)/index.tsx`) shows a one-time **“Resume Workout?”** alert on cold start when storage has an active session.

Today, the only exit path from an active workout is **Discard Workout** (clears storage) or **Keep Going**. There is no way to browse tabs/menu without abandoning progress. Home does not surface a persistent resume entry point while the app stays open, and there is no foreground **return-to-workout** prompt when the user backgrounds the app and comes back.

`currentExerciseIndex` lives only in Zustand memory and is lost when the store is reset or the app process is killed, so resume may land on exercise 1 even though logged sets are preserved.

## Goal

Let users **leave (pause)** an active workout to navigate the app, then **resume** from Home or via a familiar prompt when returning to the app — without discarding logged sets.

## Non-goals

- Persisting rest-timer state across leave/resume or app kill
- Push/local notifications for paused workouts
- Supporting multiple simultaneous paused workouts (one `ACTIVE_SESSION` remains the model)
- Redesigning finish-workout flow, history, or cycle advancement
- Adding a global “paused” badge on every tab screen (Home resume CTA is sufficient for this ticket)

## Requirements

1. **Leave workout action** — From the workout cancel sheet, add a **Leave Workout** option that:
   - Keeps the active session in storage (does **not** call `abandonWorkout`)
   - Navigates the user to the tab root (`/(tabs)`) so they can browse Splits, History, Settings, etc.
   - Resets in-memory rest timer state (same as discard path today)

2. **Persist resume position** — Persist `currentExerciseIndex` alongside the active session so resume returns to the last viewed exercise after leave, cold start, or app kill.

3. **Home resume CTA** — When `useWorkoutStore` has a loaded active session and the user is on Home, show a prominent **Resume {splitName}** control (above or in place of conflicting “Start Workout” for that same split). Tapping navigates to `/workout/{splitId}`.

4. **App-return prompt** — When the app returns to foreground (`AppState` → `active`) and an active session exists while the user is **not** on the workout screen, show the same style alert as cold start: **Resume** (navigate to workout) / **Discard** (`abandonWorkout`). Avoid duplicate alerts if one was just shown.

5. **Start-workout conflicts** — If the user tries to start a different split while a paused workout exists, keep existing guard behavior in `app/workout/[splitId].tsx` (unfinished-workout alert). On Home, if today’s split differs from the paused session, still show the resume CTA for the paused session; do not silently overwrite it.

6. **Copy & a11y** — Use “Leave Workout” in the sheet (user-facing “pause” semantics). Resume button needs `accessibilityLabel` (e.g. `Resume paused workout`).

## Acceptance criteria

- [ ] Workout cancel sheet includes **Leave Workout**; choosing it navigates to Home/tabs and the active session remains in storage with all logged sets intact
- [ ] **Discard Workout** still clears `ACTIVE_SESSION` and store state (no regression)
- [ ] After leaving a workout mid-session, Home shows a **Resume {splitName}** button/card while the session is active
- [ ] Tapping Home resume opens `/workout/{splitId}` and restores the exercise index the user was on when they left
- [ ] Cold start with an active session still shows **Resume Workout?** with Resume / Discard actions
- [ ] Backgrounding the app with a paused workout and returning to foreground (not on workout screen) shows the **Resume Workout?** prompt
- [ ] No duplicate Resume alerts fire from cold start + foreground handler in the same session
- [ ] Starting `/workout/{otherSplitId}` while a paused workout exists still shows the existing unfinished-workout conflict alert
- [ ] Unit tests cover new store transitions (`leaveWorkout`, index persistence on `goToExercise`, resume load)

## Edge cases

- User leaves workout, then taps **Discard** on the return prompt → session cleared; Home resume CTA disappears
- User leaves on exercise 3, kills app, reopens → resume lands on exercise 3 (not 1)
- User leaves workout, finishes browsing, opens same split from **All Splits** → resumes existing session (no new session created)
- User leaves workout with zero sets logged → session still resumable; discard remains available
- Active session references a deleted split → workout screen shows existing error/empty bootstrap; Home resume still navigates but user sees graceful error (no crash)
- User is already on the workout screen when app foregrounds → do **not** show return prompt
- Rapid AppState inactive → active transitions → prompt debounced or guarded so only one alert is visible

## Implementation notes

**Response mode:** Standard ceremony (multi-file feature).

### Store & persistence

- **`src/features/workout/types.ts`** — Extend `WorkoutSession` (or introduce a small `ActiveSessionSnapshot` type) with optional `currentExerciseIndex: number` (default `0` when absent for backward compatibility).
- **`src/features/workout/store/workoutStore.ts`**
  - Add `leaveWorkout(): Promise<void>` — no-op if no session; persists session + index; does **not** call `clearActiveSession`.
  - Update `goToExercise`, `startWorkout`, `finishWorkout`, `abandonWorkout`, and `loadActiveSession` to read/write `currentExerciseIndex` via `setActiveSession`.
  - On `loadActiveSession`, hydrate `currentExerciseIndex` from stored session (fallback `0`).
- **`src/storage/adapters/sessions.ts`** — Ensure `setActiveSession` / `getActiveSession` pass through the extended shape; no new storage key required if index is embedded on the session object.

### Workout screen

- **`app/workout/[splitId].tsx`**
  - Add `handleLeaveWorkout`: dismiss sheet, reset rest timer, call `leaveWorkout()`, `router.replace('/(tabs)')`.
  - Insert **Leave Workout** row in the cancel `BottomSheetModal` (between Discard and Keep Going). Update close-button `accessibilityLabel` if it still reads “Cancel workout” only.
  - Confirm bootstrap path for matching `splitId` uses stored `currentExerciseIndex` (via store after `loadActiveSession`).

### Home & return prompt

- **`app/(tabs)/index.tsx`**
  - Subscribe to `session` / `isLoaded` from `useWorkoutStore`; call `loadActiveSession` on mount (already partially done).
  - Render paused-workout resume card/button when `session !== null`.
  - Adjust Today card: if paused session is for today’s split, prefer **Resume** over **Start Workout** (or hide Start while paused).
- **`src/features/workout/hooks/useResumeWorkoutPrompt.ts`** *(new, recommended)* — Shared hook encapsulating:
  - Cold-start check (once per mount)
  - `AppState` foreground listener with “not on workout route” guard (use `usePathname` from expo-router or a ref set by workout screen)
  - Single-flight / debounce so one alert at a time
  - Resume → `router.push(\`/workout/${splitId}\`)`; Discard → `abandonWorkout()`
- Wire hook from **`app/(tabs)/index.tsx`** (and optionally **`app/_layout.tsx`** if prompt should appear regardless of active tab — prefer tabs root or `_layout` only if Home-only proves insufficient; start with Home + `_layout` AppState if user can pause and stay on another tab).

### Tests

- **`src/features/workout/__tests__/workoutStore.test.ts`** *(new)* — Vitest tests with mocked `sessions` adapter:
  - `leaveWorkout` retains session in storage
  - `goToExercise` persists index
  - `loadActiveSession` restores index
  - `abandonWorkout` clears session and resets index

### Export surface

- **`src/features/workout/index.ts`** — Export new hook if placed under `features/workout`.

Keep diffs small: reuse existing Alert copy (“Resume Workout?”, “You have an unfinished {splitName} workout.”) for consistency.

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual (UI):**

1. Start a workout, log at least one set on exercise 2+, open cancel sheet → **Leave Workout** → confirm landing on Home/tabs with **Resume {splitName}** visible.
2. Tap Resume → confirm same exercise index and logged sets appear.
3. Leave workout → background app → foreground → confirm **Resume Workout?** alert; Resume navigates correctly; Discard clears CTA.
4. Force-quit app with paused workout → relaunch → cold-start alert + Home resume CTA; resume restores exercise index.
5. Leave workout → tap **Discard Workout** from sheet on re-entry path → confirm session cleared everywhere.
6. With paused workout for split A, attempt to start split B → confirm existing conflict alert still works.
7. Regression: complete a workout via Finish → confirm `ACTIVE_SESSION` cleared and no resume CTA on Home.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — All touched files map to the ticket: store/types persistence, workout leave action, Home resume CTA, shared resume prompt hook, tests, and `vitest.config` include path. No unrelated orchestrator, LogSheet, or layout-regression changes; recent commit guard is clean.
- **Minimal diff** — Surgical edits only: no full-file rewrites, no new dependencies. Cancel sheet snap height (`28%` → `38%`) is a reasonable fit for the added row.
- **AGENTS.md patterns** — Zustand store + storage adapter persistence (not raw AsyncStorage in UI), feature hook under `src/features/workout/hooks/`, NativeWind `className` on Home/workout UI, new store logic covered by Vitest, feature export added in `index.ts`. Typecheck/lint/test all pass.
- **Leave workout** — `leaveWorkout()` persists session + index without `clearActiveSession`; workout screen resets rest timer and navigates to `/(tabs)` mirroring discard navigation. Matches requirements.
- **Index persistence** — `currentExerciseIndex` embedded on `WorkoutSession`, written on `goToExercise` / `leaveWorkout`, hydrated in `loadActiveSession`, preserved on `logSet` / `deleteSet` / `substituteExercise`. Backward-compatible optional field.
- **Home resume CTA** — Shows paused card when session split ≠ today’s split; swaps Today “Start Workout” for “Resume {splitName}” when paused session matches today. `accessibilityLabel="Resume paused workout"` present.
- **App-return prompt** — `useResumeWorkoutPrompt` in tabs `_layout` covers all tabs (per ticket note). Single-flight alert ref, workout-route guard, 2s cold-start guard, debounced foreground handler. Cold-start alert correctly moved out of Home to avoid duplication.
- **Tests** — Store tests cover `leaveWorkout`, `goToExercise` persistence, `loadActiveSession` restore/default, and `abandonWorkout` reset.
- **Nits (non-blocking)** — `loadActiveSession` does not clamp stored index (unlike `goToExercise`); `goToExercise` uses fire-and-forget `void setActiveSession`; Home and hook both call `loadActiveSession` (harmless duplicate hydrate); `todaySplit !== undefined` is redundant with the null check. None violate Pass 1 quality gates.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; Vitest reports 26 passing tests.
- Store ACs have test coverage in `src/features/workout/__tests__/workoutStore.test.ts`: `leaveWorkout` retains storage, `goToExercise` persists index, `loadActiveSession` restores/defaults index, and `abandonWorkout` clears session and resets index.
- Diff evidence covers Leave Workout: cancel sheet adds `Leave Workout`, calls `leaveWorkout()`, resets rest timer, and navigates to `/(tabs)` without clearing `ACTIVE_SESSION`.
- Diff evidence covers Home resume CTA: Home reads active session, renders `Resume {splitName}`, includes `accessibilityLabel="Resume paused workout"`, and prefers Resume over Start for today’s split.
- Diff evidence covers cold-start and app-return prompts through `useResumeWorkoutPrompt`, wired in tabs layout, with route guard for workout screens and duplicate-alert guards.
- Existing unfinished-workout guard in `app/workout/[splitId].tsx` is not removed in the provided diff, so start-workout conflict behavior appears preserved.
- Manual UI/device checks such as visual sheet layout, tap behavior, background/foreground behavior on device, and keyboard/device-specific presentation are deferred to manual QA per CLI orchestrator rules.
- Regression guard: no evidence that the diff touches or undoes the recent LogSheet anchoring/multiline notes fixes or orchestrator queue/model behavior.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **Secrets**: No hardcoded secrets, API keys, tokens, or credentials introduced anywhere in the diff. Devtools middleware is gated on `process.env.APP_ENV === 'development'`, which is correct.

- **AsyncStorage safety**: All `AsyncStorage` calls go through the `sessions.ts` adapter. `setActiveSession`, `clearActiveSession`, and `saveSession` all wrap in `try/catch` and surface errors properly. `getActiveSession` silently returns `null` on parse failure — safe fallback. No new storage keys were added; `currentExerciseIndex` is embedded on the existing `ACTIVE_SESSION` object, keeping the storage surface minimal. No raw `AsyncStorage` calls appear in the new feature code.

- **Data validation — `goToExercise` index clamping**: The new `goToExercise` implementation correctly clamps the incoming index with `Math.max(0, Math.min(index, session.exercises.length - 1))` before persisting. Good.

- **Data validation — `loadActiveSession` missing clamp**: `stored?.currentExerciseIndex ?? 0` is written directly to state without clamping against `session.exercises.length`. If the stored value is stale or out of range (e.g., exercises were removed from the split after the session was saved), an out-of-bounds index enters Zustand state and could cause the workout screen to render `undefined` for the current exercise. This is a robustness gap rather than an exploitable vulnerability (data is app-authored, stored locally, no network path), so it does not warrant a FAIL at this pass level but should be noted for the correctness pass.

- **`void setActiveSession(updated)` in `goToExercise`**: Fire-and-forget write. If AsyncStorage fails mid-exercise-navigation, the persisted index silently diverges from in-memory state. Errors won't crash the UI, but silent data loss is possible. This is consistent with existing patterns elsewhere in the store.

- **`splitId` interpolated into a router path**: `router.push(\`/workout/${splitId}\`)` uses a value sourced from AsyncStorage. The data is entirely app-authored (set during `startWorkout` from a local splits store), there is no network ingestion path, and expo-router will simply fail to match an unexpected route rather than execute arbitrary code. Risk is negligible.

- **Alert deduplication**: `alertVisibleRef` prevents stacking alerts; `coldStartPromptAtRef` + `COLD_START_GUARD_MS` suppresses a foreground-return alert if a cold-start alert fired within the last 2 s. `isWorkoutRoute` guard prevents the prompt appearing while on the workout screen. Deduplication logic is sound.

- **`cancelable: true` + `onDismiss`**: `onDismiss` resets `alertVisibleRef.current` on Android dismiss-by-tap-outside; on iOS this callback is never called (iOS Alerts require a button press), but the button `onPress` handlers also reset the flag — so no permanent lock-out is possible.

- **No unvalidated user-input surfaces added**: All alert messages interpolate values from the local store (`splitName`, `splitId`), not from any remote or user-typed source.

- **Tests**: The new Vitest suite correctly covers `leaveWorkout` retention, `goToExercise` persistence, `loadActiveSession` index hydration (including the `0`-default case), and `abandonWorkout` reset. All 5 tests pass. Mocks prevent real AsyncStorage calls.
## Run 2026-06-29T02:31:16.435Z

Artifacts: `tickets/20260628-222753`

### Ticket
## Title

Pause / leave active workout with Home resume and app-return prompt

## Context

Grynd persists in-progress workouts via `ACTIVE_SESSION` in `src/storage/adapters/sessions.ts` and `useWorkoutStore` (`src/features/workout/store/workoutStore.ts`). The workout screen (`app/workout/[splitId].tsx`) can bootstrap-resume a matching session, and Home currently loads the active session on mount.

Today, exiting an active workout effectively means **Discard Workout** (clears storage) or **Keep Going**. There is no first-class way to **leave (pause)** and browse tabs (Splits, History, Settings) without abandoning logged sets. Home does not consistently surface a persistent resume entry point while the app stays open, and there is no foreground **return-to-workout** prompt when the user backgrounds the app and returns.

`currentExerciseIndex` is tracked in Zustand but is not reliably persisted on leave, so resume can land on exercise 1 even though logged sets survive a cold start.

**Response mode:** Standard ceremony (multi-file feature).

## Goal

Let users **leave (pause)** an active workout to navigate the app menu, then **resume** from a Home button or via the familiar **Resume Workout?** alert when returning to the app — without discarding logged sets.

## Non-goals

- Persisting rest-timer state across leave/resume or app kill
- Push/local notifications for paused workouts
- Multiple simultaneous paused workouts (one `ACTIVE_SESSION` remains the model)
- Redesigning finish-workout flow, history, or cycle advancement
- Global “paused” badge on every tab (Home resume CTA is sufficient)
- Intercepting OS back / swipe-dismiss without using the cancel sheet (unless trivial `beforeRemove` is added; not required for MVP)

## Requirements

1. **Leave workout action** — From the workout cancel sheet, add **Leave Workout** that:
   - Keeps the active session in storage (does **not** call `abandonWorkout`)
   - Persists the current exercise index
   - Resets in-memory rest timer state (same as discard today)
   - Navigates to tab root (`/(tabs)`) so the user can browse the menu

2. **Persist resume position** — Embed `currentExerciseIndex` on the stored `WorkoutSession` so resume returns to the last viewed exercise after leave, cold start, or app kill.

3. **Home resume CTA** — When an active session is loaded and the user is on Home (`app/(tabs)/index.tsx`):
   - Show a prominent **Resume {splitName}** control when a paused workout exists
   - If the paused session matches today’s split, prefer **Resume** over **Start Workout** in the TODAY card
   - Tapping navigates to `/workout/{splitId}`

4. **App-return prompt** — When the app returns to foreground (`AppState` → `active`) and an active session exists while the user is **not** on a workout route, show the familiar alert: **Resume Workout?** with **Resume** / **Discard** (same copy as cold start). Avoid duplicate alerts from cold start + foreground in the same session.

5. **Start-workout conflicts** — Preserve existing guard in `app/workout/[splitId].tsx` when starting a different split while a paused workout exists. On Home, if today’s split differs from the paused session, still show the paused-session resume CTA; do not silently overwrite storage.

6. **Copy & a11y** — User-facing sheet label: **Leave Workout** (pause semantics). Resume controls need `accessibilityLabel` (e.g. `Resume paused workout`).

## Acceptance criteria

- [ ] Workout cancel sheet includes **Leave Workout**; choosing it navigates to tabs/Home and `ACTIVE_SESSION` remains with all logged sets intact
- [ ] **Discard Workout** still clears `ACTIVE_SESSION` and store state (no regression)
- [ ] After leaving mid-session, Home shows **Resume {splitName}** (dedicated card and/or TODAY card swap) while the session is active
- [ ] Tapping Home resume opens `/workout/{splitId}` and restores the exercise index from when the user left
- [ ] Cold start with an active session shows **Resume Workout?** with Resume / Discard actions
- [ ] Backgrounding the app with a paused workout and returning to foreground (not on workout screen) shows **Resume Workout?**
- [ ] No duplicate Resume alerts fire from cold start + foreground handler in the same session
- [ ] Starting `/workout/{otherSplitId}` while a paused workout exists still shows the existing unfinished-workout conflict alert
- [ ] Unit tests cover `leaveWorkout`, `goToExercise` index persistence, and `loadActiveSession` index restore

## Edge cases

- User leaves workout, then taps **Discard** on the return prompt → session cleared; Home resume CTA disappears
- User leaves on exercise 3, kills app, reopens → resume lands on exercise 3 (not 1)
- User leaves workout, browses tabs, opens the same split from **All Splits** → resumes existing session (no duplicate session)
- User leaves with zero sets logged → session still resumable; discard remains available
- Active session references a deleted split → navigate gracefully with existing bootstrap error handling (no crash)
- User is on the workout screen when app foregrounds → do **not** show return prompt
- Rapid `inactive` → `active` AppState transitions → debounce/guard so only one alert is visible
- User leaves workout, stays in app on non-Home tabs → no foreground alert until app background/foreground; resume available when they return to Home

## Implementation notes

### Store & persistence

- **`src/features/workout/types.ts`** — Add optional `currentExerciseIndex?: number` on `WorkoutSession` (default `0` when absent for backward compatibility).
- **`src/features/workout/store/workoutStore.ts`**
  - Add `leaveWorkout(): Promise<void>` — persist session + index; do **not** call `clearActiveSession`.
  - Update `goToExercise`, `startWorkout`, `logSet`, `deleteSet`, `substituteExercise`, `finishWorkout`, `abandonWorkout`, and `loadActiveSession` to read/write index via `setActiveSession`.
  - Clamp index in `goToExercise`; optionally clamp on `loadActiveSession` for stale stored values.
- **`src/storage/adapters/sessions.ts`** — Pass through extended session shape; no new storage key if index is embedded on the session object.

### Workout screen

- **`app/workout/[splitId].tsx`**
  - Add `handleLeaveWorkout`: dismiss sheet, `resetRestTimer()`, `await leaveWorkout()`, `router.replace('/(tabs)')`.
  - Insert **Leave Workout** row in the cancel bottom sheet (between **Discard Workout** and **Keep Going**); adjust sheet height if needed.
  - Confirm matching-`splitId` bootstrap uses stored index after `loadActiveSession`.

### Home & app-return prompt

- **`app/(tabs)/index.tsx`**
  - Subscribe to `session` / `isLoaded`; call `loadActiveSession` on mount.
  - Render paused-workout resume card when `session !== null` and split ≠ today’s split.
  - Swap TODAY **Start Workout** → **Resume {splitName}** when paused session matches today’s split.
- **`src/features/workout/hooks/useResumeWorkoutPrompt.ts`** *(new)* — Encapsulate cold-start check, `AppState` foreground listener, workout-route guard (`pathname.startsWith('/workout/')`), single-flight/debounce, Resume → `router.push`, Discard → `abandonWorkout`.
- **`app/(tabs)/_layout.tsx`** — Wire `useResumeWorkoutPrompt()` so the prompt works from any tab (not Home-only).
- **`src/features/workout/index.ts`** — Export the new hook.

### Tests

- **`src/features/workout/__tests__/workoutStore.test.ts`** *(new or extend)* — Mock `src/storage/adapters/sessions.ts`:
  - `leaveWorkout` retains session in storage
  - `goToExercise` persists index
  - `loadActiveSession` restores index (and defaults to `0`)
  - `abandonWorkout` clears session and resets index

Reuse existing alert copy for consistency: **Resume Workout?** / **You have an unfinished {splitName} workout.**

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual (UI):**

1. Start a workout, log sets on exercise 2+, open cancel sheet → **Leave Workout** → confirm landing on tabs with **Resume {splitName}** on Home.
2. Browse Splits/History/Settings, return to Home → resume CTA still visible; tap Resume → same exercise index and logged sets.
3. Leave workout → background app → foreground on a tab → confirm **Resume Workout?**; Resume navigates correctly; Discard clears CTA and storage.
4. Force-quit with paused workout → relaunch → cold-start alert + Home resume CTA; resume restores exercise index.
5. Leave workout → re-enter via **Discard Workout** on sheet or alert → session cleared everywhere.
6. With paused workout for split A, start split B → confirm unfinished-workout conflict alert.
7. Regression: finish a workout → `ACTIVE_SESSION` cleared; no resume CTA or return prompt on Home.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — Diff touches only `workoutStore.ts` and `workoutStore.test.ts`, aligned with ticket requirement 2 (“optionally clamp on `loadActiveSession` for stale stored values”). No unrelated files or scope creep.
- **Minimal diff** — ~16 lines in the store plus targeted test updates; no full-file rewrites or new dependencies.
- **Patterns (AGENTS.md)** — Clamping uses the same `Math.max(0, Math.min(...))` approach as `goToExercise`; Zustand + storage-adapter persistence unchanged; tests mock `sessions` adapter per project conventions.
- **TypeScript** — No `any` or type escapes; clamped index is written back onto the in-memory `session` object so `session.currentExerciseIndex` stays in sync with store state.
- **Regression guard** — Does not undo pause/resume behavior from `4dd2f1c`; strengthens resume-position restore rather than removing leave/resume, Home CTA, or prompt logic committed elsewhere.
- **Tests** — “Restores stored index” now uses index `1` (valid for the 2-exercise fixture); new case covers stale index `99` → clamped to `1`. Existing `leaveWorkout`, `goToExercise`, `abandonWorkout` coverage untouched.
- **Quality gates** — `typecheck`, `lint`, and `test` all pass (27/27).
- **Minor note (non-blocking)** — Clamped index is not persisted back via `setActiveSession` on load; acceptable per ticket (“optionally clamp”) since in-memory correction is sufficient for resume UX. Empty `exercises` array skips clamping — extremely unlikely edge case, not introduced by this diff.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Acceptance criteria have reasonable diff evidence: `Leave Workout` keeps `ACTIVE_SESSION`, resets rest timer, and routes to `/(tabs)`; discard still clears session.
- Resume position is persisted on session updates and restored by `loadActiveSession`, including a new stale-index clamp test.
- Home shows `Resume {splitName}` with `accessibilityLabel="Resume paused workout"` and swaps the TODAY CTA when the active session matches today’s split.
- App-return/cold-start prompt evidence exists in `useResumeWorkoutPrompt`, with workout-route guard, single-alert guard, and cold-start foreground duplicate guard.
- Existing unfinished-workout conflict alert is preserved when opening a different split.
- Required automated gates passed: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; 27 tests passed.
- Store logic test coverage includes `leaveWorkout`, `goToExercise` persistence, `loadActiveSession` restore/default/clamp, and `abandonWorkout`.
- Manual-only UI/device checks are deferred to manual QA: visual sheet behavior, physical background/foreground behavior, tap target feel, and on-device navigation confirmation.
- Regression guard: no evidence the diff undoes the listed recent pause/resume or LogSheet/orchestrator commits.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **Secrets / credentials** — No API keys, tokens, or credentials present anywhere in the diff or the touched files. `STORAGE_KEYS` is an enum reference, not an inline secret.

- **`devtools` middleware** — Correctly gated on `process.env.APP_ENV === 'development'` (line 203); store state is not exposed to Redux DevTools in production builds.

- **`AsyncStorage` read safety (`getActiveSession`)** — Pre-existing pattern: `JSON.parse(raw) as WorkoutSession` is an unsafe cast with no runtime schema validation. Not introduced by this diff; no regression. Callers apply defensive clamping on the result.

- **`AsyncStorage` write safety** — `setActiveSession` and `clearActiveSession` both throw on failure and are `await`-ed in `leaveWorkout`, `logSet`, `deleteSet`, `substituteExercise`, `finishWorkout`, and `startWorkout`, so errors propagate to callers. No silent swallow on the critical paths.

- **`goToExercise` fire-and-forget write** — `void setActiveSession(updated)` (line 143) means a storage write failure during navigation is silently dropped. This is a pre-existing pattern, not introduced by the diff. The subsequent `leaveWorkout` re-persists the in-memory index with a properly `await`-ed write, which recovers the value if `goToExercise`'s write was lost. Not a regression.

- **Index clamping on load** — New `Math.max(0, Math.min(...))` guard in `loadActiveSession` (lines 52–55) correctly bounds a stale or adversarially large `currentExerciseIndex` from storage. This is a positive data-integrity improvement.

- **`leaveWorkout` does not clamp before persisting** — If `currentExerciseIndex` in Zustand state is somehow out-of-range (e.g. the test at line 61 deliberately sets it to `2` for a 2-exercise session), `leaveWorkout` writes the un-clamped value. The load-time clamp in `loadActiveSession` corrects it on every resume, so the unsafe value never reaches UI. This is a minor inconsistency, not an exploitable vulnerability.

- **`loadActiveSession` zero-exercise edge case** — When `stored.exercises.length === 0` the clamping block is skipped. A non-zero stored index persists in memory for a 0-length exercise list. `goToExercise` clamps on access, so no OOB array access reaches the UI. Edge case is sufficiently contained.

- **`substituteExercise` input handling** — `substituteName.trim()` guard is in place; empty/whitespace names are rejected before touching state or storage.

- **Test mock isolation** — All four storage functions are mocked; no real `AsyncStorage` calls are made in tests. Mock types are correctly constrained to the real function signatures. No test data contains sensitive patterns.

- **No regression on `abandonWorkout`** — `clearActiveSession` is still called and the store is reset to `null` / `0`; the discard path from prior commits (4dd2f1c) is intact.
## Run 2026-06-29T02:35:04.834Z

Artifacts: `tickets/20260628-223145`

### Ticket
## Title

Pause / leave active workout with Home resume and app-return prompt

## Context

Grynd persists in-progress workouts via `ACTIVE_SESSION` (`src/storage/adapters/sessions.ts`) and `useWorkoutStore` (`src/features/workout/store/workoutStore.ts`). The workout screen (`app/workout/[splitId].tsx`) can bootstrap-resume a matching session.

Today, exiting an active workout effectively means **Discard Workout** (clears storage) or **Keep Going**. Users cannot browse the tab menu (Home, Splits, History, Settings) without abandoning logged sets. When a workout is paused (left), Home does not surface a persistent resume entry point, and there is no foreground **return-to-workout** prompt when the user backgrounds the app and returns.

`currentExerciseIndex` lives in Zustand and is not reliably persisted on leave, so resume can land on exercise 1 even though logged sets survive storage.

**Response mode:** Standard ceremony (multi-file feature).

## Goal

Let users **leave (pause)** an active workout to navigate the app menu, then **resume** from a Home button or via the familiar **Resume Workout?** alert when returning to the app — without discarding logged sets.

## Non-goals

- Persisting rest-timer state across leave/resume or app kill
- Push/local notifications for paused workouts
- Multiple simultaneous paused workouts (one `ACTIVE_SESSION` remains the model)
- Redesigning finish-workout flow, history, or cycle advancement
- Global “paused” badge on every tab (Home resume CTA is sufficient)
- Intercepting OS back / swipe-dismiss without using the cancel sheet (unless trivial `beforeRemove` is added; not required for MVP)

## Requirements

1. **Leave workout action** — From the workout cancel sheet, add **Leave Workout** that:
   - Keeps the active session in storage (does **not** call `abandonWorkout`)
   - Persists the current exercise index
   - Resets in-memory rest timer state (same as discard today)
   - Navigates to tab root (`/(tabs)`) so the user can browse the menu

2. **Persist resume position** — Embed `currentExerciseIndex` on the stored `WorkoutSession` so resume returns to the last viewed exercise after leave, cold start, or app kill.

3. **Home resume CTA** — When an active session is loaded and the user is on Home (`app/(tabs)/index.tsx`):
   - Show a prominent **Resume {splitName}** control when a paused workout exists
   - If the paused session matches today’s split, prefer **Resume** over **Start Workout** in the TODAY card
   - Tapping navigates to `/workout/{splitId}`

4. **App-return prompt** — When the app returns to foreground (`AppState` → `active`) and an active session exists while the user is **not** on a workout route, show the familiar alert: **Resume Workout?** with **Resume** / **Discard** (same copy as cold start). Avoid duplicate alerts from cold start + foreground in the same session.

5. **Start-workout conflicts** — Preserve existing guard in `app/workout/[splitId].tsx` when starting a different split while a paused workout exists. Tapping **Resume** in the conflict alert must navigate to the paused workout’s split (not leave the user on the wrong route). On Home, if today’s split differs from the paused session, still show the paused-session resume CTA; do not silently overwrite storage.

6. **Copy & a11y** — User-facing sheet label: **Leave Workout** (pause semantics). Resume controls need `accessibilityLabel` (e.g. `Resume paused workout`).

## Acceptance criteria

- [ ] Workout cancel sheet includes **Leave Workout**; choosing it navigates to tabs/Home and `ACTIVE_SESSION` remains with all logged sets intact
- [ ] **Discard Workout** still clears `ACTIVE_SESSION` and store state (no regression)
- [ ] After leaving mid-session, Home shows **Resume {splitName}** (dedicated card and/or TODAY card swap) while the session is active
- [ ] Tapping Home resume opens `/workout/{splitId}` and restores the exercise index from when the user left
- [ ] Cold start with an active session shows **Resume Workout?** with Resume / Discard actions
- [ ] Backgrounding the app with a paused workout and returning to foreground (not on workout screen) shows **Resume Workout?**
- [ ] No duplicate Resume alerts fire from cold start + foreground handler in the same session
- [ ] Starting `/workout/{otherSplitId}` while a paused workout exists still shows the existing unfinished-workout conflict alert; **Resume** navigates to the paused split’s workout screen
- [ ] Unit tests cover `leaveWorkout`, `goToExercise` index persistence, and `loadActiveSession` index restore

## Edge cases

- User leaves workout, then taps **Discard** on the return prompt → session cleared; Home resume CTA disappears
- User leaves on exercise 3, kills app, reopens → resume lands on exercise 3 (not 1)
- User leaves workout, browses tabs, opens the same split from **All Splits** → resumes existing session (no duplicate session)
- User leaves with zero sets logged → session still resumable; discard remains available
- Active session references a deleted split → navigate gracefully with existing bootstrap error handling (no crash)
- User is on the workout screen when app foregrounds → do **not** show return prompt
- Rapid `inactive` → `active` AppState transitions → debounce/guard so only one alert is visible
- User leaves workout, stays in app on non-Home tabs → no foreground alert until app background/foreground; resume available when they return to Home
- User opens a different split while paused → conflict alert **Resume** replaces route to `/workout/{pausedSplitId}` (not `/workout/{requestedSplitId}`)

## Implementation notes

### Store & persistence

- **`src/features/workout/types.ts`** — Add optional `currentExerciseIndex?: number` on `WorkoutSession` (default `0` when absent for backward compatibility).
- **`src/features/workout/store/workoutStore.ts`**
  - Add `leaveWorkout(): Promise<void>` — persist session + index; do **not** call `clearActiveSession`.
  - Update `goToExercise`, `startWorkout`, `logSet`, `deleteSet`, `substituteExercise`, `finishWorkout`, `abandonWorkout`, and `loadActiveSession` to read/write index via `setActiveSession`.
  - Clamp index in `goToExercise`; optionally clamp on `loadActiveSession` for stale stored values.
- **`src/storage/adapters/sessions.ts`** — Pass through extended session shape; no new storage key if index is embedded on the session object.

### Workout screen

- **`app/workout/[splitId].tsx`**
  - Add `handleLeaveWorkout`: dismiss sheet, `resetRestTimer()`, `await leaveWorkout()`, `router.replace('/(tabs)')`.
  - Insert **Leave Workout** row in the cancel bottom sheet (between **Discard Workout** and **Keep Going**); adjust sheet height if needed.
  - Confirm matching-`splitId` bootstrap uses stored index after `loadActiveSession`.
  - Fix conflict-alert **Resume** handler: `router.replace(\`/workout/${storeSession.splitId}\`)` (or equivalent) instead of only setting `bootstrapState`.

### Home & app-return prompt

- **`app/(tabs)/index.tsx`**
  - Subscribe to `session` / `isLoaded`; call `loadActiveSession` on mount.
  - Render paused-workout resume card when `session !== null` and split ≠ today’s split.
  - Swap TODAY **Start Workout** → **Resume {splitName}** when paused session matches today’s split.
- **`src/features/workout/hooks/useResumeWorkoutPrompt.ts`** *(new)* — Encapsulate cold-start check, `AppState` foreground listener, workout-route guard (`pathname.startsWith('/workout/')`), single-flight/debounce, Resume → `router.push`, Discard → `abandonWorkout`.
- **`app/(tabs)/_layout.tsx`** — Wire `useResumeWorkoutPrompt()` so the prompt works from any tab (not Home-only).
- **`src/features/workout/index.ts`** — Export the new hook.

### Tests

- **`src/features/workout/__tests__/workoutStore.test.ts`** *(new or extend)* — Mock `src/storage/adapters/sessions.ts`:
  - `leaveWorkout` retains session in storage
  - `goToExercise` persists index
  - `loadActiveSession` restores index (and defaults to `0`)
  - `abandonWorkout` clears session and resets index

Reuse existing alert copy for consistency: **Resume Workout?** / **You have an unfinished {splitName} workout.**

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual (UI):**

1. Start a workout, log sets on exercise 2+, open cancel sheet → **Leave Workout** → confirm landing on tabs with **Resume {splitName}** on Home.
2. Browse Splits/History/Settings, return to Home → resume CTA still visible; tap Resume → same exercise index and logged sets.
3. Leave workout → background app → foreground on a tab → confirm **Resume Workout?**; Resume navigates correctly; Discard clears CTA and storage.
4. Force-quit with paused workout → relaunch → cold-start alert + Home resume CTA; resume restores exercise index.
5. Leave workout → re-enter via **Discard Workout** on sheet or alert → session cleared everywhere.
6. With paused workout for split A, start split B → confirm unfinished-workout conflict alert; **Resume** opens split A’s workout (not split B).
7. Regression: finish a workout → `ACTIVE_SESSION` cleared; no resume CTA or return prompt on Home.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — Diff touches only `app/workout/[splitId].tsx` (3 lines). It directly implements ticket requirement #5 / implementation note: conflict-alert **Resume** must navigate to the paused split, not leave the user on the requested route. No unrelated files or scope creep.

- **Minimal diff** — Surgical fix: replaces incorrect `setBootstrapState('ready')` on the wrong split with `router.replace(\`/workout/${storeSession.splitId}\`)`, adds `router` to the effect dependency array, and uses an early `cancelled` return consistent with sibling handlers in the same `init` effect.

- **Pattern / AGENTS.md** — Uses Expo Router navigation from the screen layer (same file already uses `router.replace('/(tabs)')` in `handleLeaveWorkout`). Store persistence stays in Zustand/storage adapters; no raw AsyncStorage in the component. No new dependencies, no file rewrites, no `any`.

- **Correctness** — Prior behavior left the user on `/workout/{requestedSplitId}` with bootstrap forced to `ready`, violating acceptance criterion #8. `router.replace` to `storeSession.splitId` remounts the correct workout screen, where matching-split bootstrap (`loadActiveSession` → `setBootstrapState('ready')`) runs as intended.

- **Regression guard** — Does not undo pause/leave/resume behavior from `4dd2f1c` / `bc74ee1` (Leave Workout, Home resume CTA, `useResumeWorkoutPrompt`, index persistence). It fixes a gap in the committed conflict-alert handler rather than removing any of that work.

- **Quality gates** — `npm run typecheck`, `npm run lint`, and `npm run test` all pass (27/27) per provided tool output.

- **Minor note (non-blocking)** — Conflict alert uses `router.replace` while Home and `useResumeWorkoutPrompt` use `router.push`; both are valid here, and `replace` is appropriate when correcting a wrong workout route.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited `0`; `27` tests passed.
- Store AC evidence is present: `WorkoutSession.currentExerciseIndex`, `leaveWorkout`, `goToExercise` persistence, `loadActiveSession` restore/default/clamp, and `abandonWorkout` reset are covered in `src/features/workout/__tests__/workoutStore.test.ts`.
- UI/static AC evidence is present: cancel sheet has `Leave Workout`, Home renders `Resume {splitName}` with accessibility labels, and tab layout wires `useResumeWorkoutPrompt`.
- App-return/cold-start prompt evidence is present in `useResumeWorkoutPrompt`, including workout-route guard, foreground debounce, and cold-start duplicate guard.
- Conflict regression is fixed by the active diff: conflict alert `Resume` now routes to `/workout/${storeSession.splitId}`.
- Manual device checks for sheet interaction, visual prominence, background/foreground UX, and tap behavior are deferred to manual QA per CLI-orchestrator rules.
- No regression found against the listed recent commits; the diff preserves pause/leave behavior and does not undo the LogSheet or orchestrator fixes.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets in diff** — The diff touches only `app/workout/[splitId].tsx` (two lines). No `.env` values, API keys, tokens, or credentials appear anywhere in the changed or supporting files.

- **AsyncStorage reads** — `getActiveSession()` in `sessions.ts` parses stored JSON with `JSON.parse(raw) as WorkoutSession` and no structural runtime validator. This is a pre-existing pattern, not introduced by this ticket. The new `currentExerciseIndex` field is safely read with a `?? 0` fallback and then clamped via `Math.max(0, Math.min(idx, exercises.length - 1))` in `loadActiveSession`, guarding against out-of-range stored integers.

- **User input sanitized** — `substituteExercise` trims and rejects empty names (pre-existing). The new `leaveWorkout` path persists no user-supplied text; it copies the already-stored session with an integer index.

- **`splitId` / `splitName` in URL construction and alerts** — `router.replace(\`/workout/${storeSession.splitId}\`)` and the Alert body use values from the sandboxed AsyncStorage session, not raw URL parameters. Expo Router treats these as internal navigation paths, not HTTP requests; there is no XSS or injection surface in a React Native app with this model.

- **No `eval`, dynamic requires, or shell commands** — Checked all touched files: `[splitId].tsx`, `workoutStore.ts`, `useResumeWorkoutPrompt.ts`, `sessions.ts`. None present.

- **File picker / document paths** — Not used in this feature.

- **AppState single-flight guard** — `alertVisibleRef.current` and the `COLD_START_GUARD_MS` window in `useResumeWorkoutPrompt.ts` correctly prevent duplicate "Resume Workout?" alerts from a cold-start + foreground transition. `isWorkoutRoute()` guard is correctly checked at display time via `pathnameRef.current`.

- **Regression guard** — The changed lines fix the conflict-alert Resume handler: old code silently set `bootstrapState('ready')` on the wrong route; new code navigates to `storeSession.splitId`. The Discard path (`abandonWorkout` → `startWorkoutForSplit`) is untouched. No rollback of prior commit behaviour detected.
