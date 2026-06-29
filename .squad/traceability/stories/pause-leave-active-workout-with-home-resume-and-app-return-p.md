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
