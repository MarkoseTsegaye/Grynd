# Paused workout: leave to browse, resume from Home, and return-to-workout prompt
## Run 2026-06-29T02:52:13.588Z

Artifacts: `tickets/20260628-224944`

### Ticket
## Title

Paused workout: leave to browse, resume from Home, and return-to-workout prompt

## Context

During an active workout, users are locked on `app/workout/[splitId].tsx` with no supported way to pause and use the rest of the app (tabs, cycle, splits, progress). Cancel currently implies **Discard Workout**, which clears the in-progress session.

The app already persists a single active session via `STORAGE_KEYS.ACTIVE_SESSION` in `src/storage/adapters/sessions.ts` and exposes it through `useWorkoutStore`. We need an explicit **Leave Workout** (pause) path that keeps that session, plus discoverable resume entry points on Home and after leaving the app.

**Response mode:** Standard ceremony (multi-file feature, store + UI + hook).

## Goal

Let users pause an in-progress workout, browse the app freely, and resume later from Home or via the existing “Resume Workout?” prompt when returning to the app—without losing logged sets or current exercise position.

## Non-goals

- Persisting rest-timer state across leave/background (timer may reset on resume).
- Supporting multiple simultaneous paused workouts (still one `ACTIVE_SESSION` max).
- Adding resume CTAs on every tab screen (Home only, per request).
- Changing workout history export/backup behavior.
- Refactoring unrelated workout UI (log sheet, swipe navigation, finish flow).

## Requirements

1. **Leave (pause) from workout screen**
   - From the workout cancel/exit affordance, offer **Leave Workout** distinct from **Discard Workout**.
   - Leave must persist the active session (sets, split, `currentExerciseIndex`) and navigate to tabs without clearing storage.
   - Discard must continue to clear the active session.

2. **Resume from Home**
   - When `useWorkoutStore.session !== null` (paused active session), Home (`app/(tabs)/index.tsx`) shows a primary **Resume {splitName}** action.
   - If the paused split is today’s scheduled split, replace **Start Workout** with **Resume** in the TODAY card.
   - If the paused split is not today’s split, show a dedicated paused-workout card above TODAY with the same resume action.
   - Tapping resume navigates to `/workout/{splitId}` and restores the saved exercise index.

3. **Resume on app return**
   - When a paused session exists and the user is not already on a workout route, show the familiar `Alert.alert('Resume Workout?', ...)` with **Discard** and **Resume** on:
     - cold start (after loading active session), and
     - foreground return from background/inactive.
   - Do not show the prompt while the user is on `/workout/*`.
   - Avoid duplicate prompts on cold start + immediate foreground (debounce/guard).

4. **Resume bootstrap on workout screen**
   - Opening `/workout/{splitId}` with a matching active session must **not** call `startWorkout` again; restore in-place.
   - Opening a different split while another session is active must keep the existing conflict alert (Discard / Resume other workout).

5. **Store & persistence**
   - `leaveWorkout` writes `currentExerciseIndex` onto the persisted `WorkoutSession`.
   - `loadActiveSession` restores and clamps `currentExerciseIndex` to valid bounds.
   - `goToExercise` persists index changes to active session storage.

## Acceptance criteria

- [ ] Workout cancel sheet includes **Leave Workout**, **Discard Workout**, and **Keep Going**; Leave navigates to tabs and does not clear `ACTIVE_SESSION`.
- [ ] After Leave, logged sets and current exercise index are unchanged when the user taps **Resume** from Home.
- [ ] Home shows **Resume {splitName}** when a paused session exists (TODAY card when split matches today; separate paused card when it does not).
- [ ] Home does not show **Start Workout** for today’s split when that split already has a paused session.
- [ ] Resuming from Home opens the workout at the saved exercise index.
- [ ] On app cold start with a paused session (and user not on `/workout/*`), the **Resume Workout?** alert appears once with working Discard and Resume actions.
- [ ] When the app returns from background with a paused session (and user not on `/workout/*`), the same alert appears (not duplicated immediately after cold-start prompt).
- [ ] Navigating to `/workout/{sameSplitId}` with an existing active session resumes without creating a new session id or wiping logged sets.
- [ ] Attempting to start a different split while a paused session exists still prompts to Discard or Resume the existing workout.
- [ ] Unit tests cover `leaveWorkout`, index persistence via `goToExercise`/`loadActiveSession`, and prompt guard logic (or pure helpers extracted for testing).

## Edge cases

- **Stale exercise index:** split edited after pause (exercises removed)—clamp index on load; never crash.
- **In-memory vs storage race:** `loadActiveSession` should not overwrite a valid in-memory session with `null` from a transient read failure.
- **Leave during open bottom sheets:** dismiss sheets/timer before navigation; no orphan modals on return.
- **Discard from global prompt:** clears session everywhere (Home card disappears).
- **Resume while already on Home resume card:** idempotent navigation to same route.
- **Rest day + paused non-today workout:** paused card still visible; TODAY shows rest UI independently.
- **User dismisses alert without choosing:** session remains paused; Home resume still available.

## Implementation notes

**Store & types**

- `src/features/workout/store/workoutStore.ts` — implement/verify `leaveWorkout()` (persist session + `currentExerciseIndex`, do not clear). Ensure `goToExercise`, `loadActiveSession`, `abandonWorkout`, and `finishWorkout` behavior align with pause/resume.
- `src/features/workout/types.ts` — ensure `WorkoutSession` includes optional `currentExerciseIndex`.
- `src/storage/adapters/sessions.ts` — no schema change expected; continue using `getActiveSession` / `setActiveSession` / `clearActiveSession`.

**Workout screen**

- `app/workout/[splitId].tsx`:
  - Add **Leave Workout** handler calling `leaveWorkout()` then `router.replace('/(tabs)')`; reset rest timer on leave.
  - Bootstrap `init()`: if stored session `splitId` matches route, set ready without `startWorkout`.
  - Keep existing conflict alert when route split ≠ active session split.

**Home resume UI**

- `app/(tabs)/index.tsx`:
  - Load active session on mount (`loadActiveSession`).
  - Derive `pausedForTodaySplit` and `showPausedResumeCard` from `session` + cycle today split.
  - Wire **Resume {splitName}** to `router.push(\`/workout/${session.splitId}\`)`.

**App-return prompt**

- `src/features/workout/hooks/useResumeWorkoutPrompt.ts` — AppState + cold-start prompt; skip on `/workout/*`; debounce foreground; call `loadActiveSession` before first prompt.
- `app/_layout.tsx` — mount `useResumeWorkoutPrompt()` at root.
- `src/features/workout/index.ts` — export hook if not already.

**Tests**

- Extend `src/features/workout/__tests__/workoutStore.test.ts` for pause/resume state transitions (already started—verify coverage matches AC).
- Add `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` (or extract `isWorkoutRoute` / prompt-eligibility helper to `src/features/workout/lib/` with unit tests) for route guard and cold-start debounce behavior.

**Optional small extract (only if needed for testability)**

- `src/features/workout/lib/workoutRoute.ts` — `isWorkoutRoute(pathname: string): boolean` shared by hook and tests.

## Test plan

**Automated (required gates):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual QA (UI):**

1. Start a workout, log at least one set, swipe to exercise 2, tap cancel → **Leave Workout** → land on Home tabs.
2. Confirm Home shows **Resume {splitName}**; tap it → workout opens on exercise 2 with sets intact.
3. Leave again; background the app (or force-quit), reopen → **Resume Workout?** alert appears; **Resume** returns to workout; repeat with **Discard** and confirm Home no longer shows resume.
4. Pause today’s split workout → Home TODAY card shows **Resume** instead of **Start Workout**.
5. Pause a non-today split → dedicated paused card appears above TODAY.
6. With paused session, tap a different split from **All Splits** → conflict alert still offers Discard / Resume existing workout.
7. While on the workout screen, background and foreground the app → no resume alert on the workout route.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope:** Diff is limited to the resume-prompt guard logic — `useResumeWorkoutPrompt.ts` refactor plus new `workoutRoute.ts` and tests. Matches the ticket’s optional extract for testability; no unrelated files or feature creep.
- **Minimal diff:** Inline `isWorkoutRoute` and cold-start guard moved to a shared lib module; hook behavior is unchanged (same 2000 ms guard, same route check, same debounce). No full-file rewrites.
- **Regression guard:** Compared against recent pause/resume commits — `COLD_START_GUARD_MS` remains 2000, `isWorkoutRoute` still uses `pathname.startsWith('/workout/')`, and foreground suppression logic is equivalent (`coldStartPromptAt !== null && now - coldStartPromptAt < guardMs`). No behavioral regression.
- **AGENTS.md compliance:** New pure functions live in `src/features/workout/lib/` (same pattern as `sortExercisesByPerformedOrder.ts`). Unit tests added per “do not skip tests for new pure functions.” No new dependencies, no `.env` / credential touches.
- **Patterns & naming:** Named exports, simple pure helpers, JSDoc on `shouldSuppressForegroundPrompt`. `COLD_START_GUARD_MS` exported for boundary tests — reasonable.
- **TypeScript:** Strict types, no `any`; optional `guardMs` param is typed with a default.
- **Tests:** Five cases cover route matching (including `/workout` edge case) and cold-start suppression boundaries (within window, at boundary, null). Aligns with ticket AC for prompt guard logic.
- **Gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all pass (reported exit code 0).
- **Minor nit (non-blocking):** `useResumeWorkoutPrompt.test.ts` tests `workoutRoute` helpers, not the hook itself. Acceptable per ticket (“or extract … with unit tests”), but `workoutRoute.test.ts` would be slightly clearer naming.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; Vitest reports 40 passing tests.
- New pure helpers in `src/features/workout/lib/workoutRoute.ts` are covered by `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts`.
- Store tests cover `leaveWorkout`, `goToExercise` index persistence, `loadActiveSession` restore/clamp behavior, discard reset, and finish persistence.
- Static AC evidence is present for Leave/Discard/Keep Going, preserving active session on leave, Home resume card/today replacement, workout bootstrap resume, conflict prompt, and root app-return prompt mounting.
- Regression guard passed: the current diff only extracts prompt route/guard helpers and keeps the recent pause/resume behavior intact.
- Manual device QA for visual sheet behavior, tap targets, and foreground/background UX is deferred to manual QA per CLI orchestrator rules.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets in diff**: The changeset contains no `.env` values, API keys, tokens, or credentials. Only two named imports and a constant removal.

- **AsyncStorage read validation (pre-existing, not introduced by diff)**: `getActiveSession()` in `sessions.ts` does `JSON.parse(raw) as WorkoutSession` — a TypeScript assertion with no runtime schema check. This predates the diff. The diff does not widen this surface. `loadActiveSession` compensates for the new `currentExerciseIndex` field with a defensive clamp (`Math.max(0, Math.min(index, exercises.length - 1))`), which is the correct guard for the data introduced by this feature.

- **`splitId` interpolated into router path**: `router.push(\`/workout/${splitId}\`)` — `splitId` originates from the persisted `WorkoutSession`, not from direct user text input. In a local React Native / Expo Router context this does not create an injection risk; the router would simply navigate to a non-existent route if the value were unexpected.

- **`splitName` in `Alert.alert()` body**: Used as display text only. Native alert dialogs have no HTML/script injection surface.

- **No `eval`, dynamic `require`, or shell execution**: Confirmed absent in all touched files (`useResumeWorkoutPrompt.ts`, `workoutRoute.ts`, the test file).

- **`shouldSuppressForegroundPrompt` extraction**: Pure function, no side effects, no I/O. The extracted helper accepts `coldStartPromptAt: number | null` — the null guard is correct and prevents a NaN comparison.

- **`isWorkoutRoute` extraction**: Simple `startsWith` check. The path `/workout` (without trailing slash) correctly returns `false`, which is tested and intentional.

- **Regression guard**: The extracted helpers preserve the exact semantics of the inline code they replaced. The `COLD_START_GUARD_MS = 2000` constant is identical to the removed inline constant and is now exported and exercised in `useResumeWorkoutPrompt.test.ts`. No behavioral regression.

- **All automated gates green**: typecheck, lint, and 40 tests pass.
## Run 2026-06-29T02:57:31.310Z

Artifacts: `tickets/20260628-225244`

### Ticket
## Title

Paused workout: leave to browse, resume from Home, and return-to-workout prompt

## Context

During an active workout, users are on `app/workout/[splitId].tsx` with no supported way to pause and browse the rest of the app (tabs, cycle, splits, progress). The cancel affordance currently centers on **Discard Workout**, which clears the in-progress session.

The app already persists a single active session via `STORAGE_KEYS.ACTIVE_SESSION` in `src/storage/adapters/sessions.ts` and exposes it through `useWorkoutStore`. We need an explicit **Leave Workout** (pause) path that keeps that session, plus discoverable resume entry points on Home and when returning to the app.

**Response mode:** Standard ceremony (multi-file feature: store + UI + hook).

## Goal

Let users pause an in-progress workout, browse the app freely, and resume later from Home or via the familiar “Resume Workout?” prompt when returning to the app—without losing logged sets or current exercise position.

## Non-goals

- Persisting rest-timer state across leave/background (timer may reset on resume).
- Supporting multiple simultaneous paused workouts (still one `ACTIVE_SESSION` max).
- Adding resume CTAs on every tab screen (Home only, per request).
- Changing workout history export/backup behavior.
- Refactoring unrelated workout UI (log sheet, swipe navigation, finish flow).

## Requirements

1. **Leave (pause) from workout screen**
   - From the workout cancel/exit affordance, offer **Leave Workout** distinct from **Discard Workout**.
   - Leave must persist the active session (sets, split, `currentExerciseIndex`) and navigate to tabs without clearing storage.
   - Discard must continue to clear the active session.

2. **Resume from Home**
   - When `useWorkoutStore.session !== null` (paused active session), Home (`app/(tabs)/index.tsx`) shows a primary **Resume {splitName}** action.
   - If the paused split is today’s scheduled split, replace **Start Workout** with **Resume** in the TODAY card.
   - If the paused split is not today’s split, show a dedicated paused-workout card above TODAY with the same resume action.
   - Tapping resume navigates to `/workout/{splitId}` and restores the saved exercise index.

3. **Resume on app return**
   - When a paused session exists and the user is not already on a workout route, show the familiar `Alert.alert('Resume Workout?', ...)` with **Discard** and **Resume** on:
     - cold start (after loading active session), and
     - foreground return from background/inactive.
   - Do not show the prompt while the user is on `/workout/*`.
   - Avoid duplicate prompts on cold start + immediate foreground (debounce/guard).

4. **Resume bootstrap on workout screen**
   - Opening `/workout/{splitId}` with a matching active session must **not** call `startWorkout` again; restore in-place.
   - Opening a different split while another session is active must keep the existing conflict alert (Discard / Resume other workout).

5. **Store & persistence**
   - `leaveWorkout` writes `currentExerciseIndex` onto the persisted `WorkoutSession`.
   - `loadActiveSession` restores and clamps `currentExerciseIndex` to valid bounds.
   - `goToExercise` persists index changes to active session storage.

## Acceptance criteria

- [ ] Workout cancel sheet includes **Leave Workout**, **Discard Workout**, and **Keep Going**; Leave navigates to tabs and does not clear `ACTIVE_SESSION`.
- [ ] After Leave, logged sets and current exercise index are unchanged when the user taps **Resume** from Home.
- [ ] Home shows **Resume {splitName}** when a paused session exists (TODAY card when split matches today; separate paused card when it does not).
- [ ] Home does not show **Start Workout** for today’s split when that split already has a paused session.
- [ ] Resuming from Home opens the workout at the saved exercise index.
- [ ] On app cold start with a paused session (and user not on `/workout/*`), the **Resume Workout?** alert appears once with working Discard and Resume actions.
- [ ] When the app returns from background with a paused session (and user not on `/workout/*`), the same alert appears (not duplicated immediately after cold-start prompt).
- [ ] Navigating to `/workout/{sameSplitId}` with an existing active session resumes without creating a new session id or wiping logged sets.
- [ ] Attempting to start a different split while a paused session exists still prompts to Discard or Resume the existing workout.
- [ ] Unit tests cover `leaveWorkout`, index persistence via `goToExercise`/`loadActiveSession`, and prompt guard logic (pure helpers in `workoutRoute.ts`).

## Edge cases

- **Stale exercise index:** split edited after pause (exercises removed)—clamp index on load; never crash.
- **In-memory vs storage race:** `loadActiveSession` should not overwrite a valid in-memory session with `null` from a transient read failure.
- **Leave during open bottom sheets:** dismiss sheets and reset rest timer before navigation; no orphan modals on return.
- **Discard from global prompt:** clears session everywhere (Home resume card disappears).
- **Resume while already on Home resume card:** idempotent navigation to same route.
- **Rest day + paused non-today workout:** paused card still visible; TODAY shows rest UI independently.
- **User dismisses alert without choosing:** session remains paused; Home resume still available.

## Implementation notes

**Store & types**

- `src/features/workout/store/workoutStore.ts` — add/verify `leaveWorkout()` (persist session + `currentExerciseIndex`, do not clear). Ensure `goToExercise`, `loadActiveSession`, `abandonWorkout`, and `finishWorkout` align with pause/resume.
- `src/features/workout/types.ts` — ensure `WorkoutSession` includes `currentExerciseIndex` (optional for backward compatibility with stored sessions).
- `src/storage/adapters/sessions.ts` — no schema change; continue using `getActiveSession` / `setActiveSession` / `clearActiveSession`.

**Workout screen**

- `app/workout/[splitId].tsx`:
  - Add **Leave Workout** handler: call `leaveWorkout()`, reset rest timer, dismiss cancel sheet, then `router.replace('/(tabs)')`.
  - Bootstrap `init()`: if stored session `splitId` matches route param, set ready without calling `startWorkout`.
  - Keep existing conflict alert when route split ≠ active session split.

**Home resume UI**

- `app/(tabs)/index.tsx`:
  - Call `loadActiveSession` on mount.
  - Derive `pausedForTodaySplit` and `showPausedResumeCard` from `session` + cycle today split.
  - Wire **Resume {splitName}** to `router.push(\`/workout/${session.splitId}\`)`.

**App-return prompt**

- `src/features/workout/hooks/useResumeWorkoutPrompt.ts` — cold-start + `AppState` foreground prompt; skip on `/workout/*`; debounce/guard against duplicate cold-start + foreground prompts; call `loadActiveSession` before first prompt.
- `app/_layout.tsx` — mount `useResumeWorkoutPrompt()` at root layout.
- `src/features/workout/index.ts` — export hook.

**Shared route helpers**

- `src/features/workout/lib/workoutRoute.ts` — `isWorkoutRoute(pathname)`, `shouldSuppressForegroundPrompt(...)`, `COLD_START_GUARD_MS` for hook + tests.

**Tests**

- Extend `src/features/workout/__tests__/workoutStore.test.ts` — `leaveWorkout`, `goToExercise` index persistence, `loadActiveSession` restore/clamp, `abandonWorkout` reset.
- Add/extend `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` — route guard and cold-start suppression boundaries.

## Test plan

**Automated (required gates):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual QA (UI):**

1. Start a workout, log at least one set, swipe to exercise 2, tap cancel → **Leave Workout** → land on Home tabs.
2. Confirm Home shows **Resume {splitName}**; tap it → workout opens on exercise 2 with sets intact.
3. Leave again; background the app (or force-quit), reopen → **Resume Workout?** alert appears; **Resume** returns to workout; repeat with **Discard** and confirm Home no longer shows resume.
4. Pause today’s split workout → Home TODAY card shows **Resume** instead of **Start Workout**.
5. Pause a non-today split → dedicated paused card appears above TODAY.
6. With paused session, tap a different split from **All Splits** → conflict alert still offers Discard / Resume existing workout.
7. While on the workout screen, background and foreground the app → no resume alert on the workout route.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope vs ticket:** Pause/resume work stays within the ticket’s surface area — `workoutStore`, `types`, `useResumeWorkoutPrompt`, `workoutRoute`, workout screen bootstrap/leave flow, Home resume UI, root `_layout` hook mount, barrel export, and unit tests. Latest commit (`f57208e`) is a minimal extract of inline prompt helpers into `workoutRoute.ts` plus tests; no unrelated feature files or dependencies.
- **Branch composition (informational):** The branch also carries the finish-confirmation ticket (`FinishWorkoutSheet`, `WorkoutDatePicker`, `finishWorkout` test). That is adjacent work on the same branch, not introduced by the pause/resume delta itself.
- **AGENTS.md patterns:** Zustand store + storage adapters for persistence; Expo Router navigation; NativeWind `className` on new Home/cancel UI; pure helpers tested with Vitest; hook exported from `src/features/workout/index.ts`. No raw AsyncStorage in components for session state.
- **Minimal diff:** Changes are additive/targeted — new store action, optional session field, hook + 14-line helper module, cancel-sheet row, Home resume cards, bootstrap resume path. No full-file rewrites of unrelated modules.
- **TypeScript:** No new `any` escapes in touched pause/resume files. `currentExerciseIndex` is optional on `WorkoutSession` for backward compatibility.
- **Naming & conventions:** Matches surrounding code (`leaveWorkout`, `loadActiveSession`, `handleLeaveWorkout`, `pausedForTodaySplit`, `showPausedResumeCard`). Accessibility labels present on resume controls.
- **Store behavior:** `leaveWorkout` persists session + index without `clearActiveSession`. `goToExercise` clamps and persists index. `loadActiveSession` restores/clamps stale index and guards `current && !stored` against transient null reads. Conflict alert on mismatched split uses `router.replace` to the active session’s split.
- **UI wiring:** Cancel sheet offers Discard / Leave / Keep Going; Leave resets rest timer and routes to `/(tabs)`. Home shows TODAY Resume vs Start and a separate paused card for non-today splits. Root `useResumeWorkoutPrompt` covers cold start + foreground with route guard, single-flight alert ref, debounce, and cold-start suppression via extracted helper.
- **Tests:** `workoutStore.test.ts` covers `leaveWorkout`, `goToExercise` persistence, `loadActiveSession` restore/default/clamp, `abandonWorkout`. `useResumeWorkoutPrompt.test.ts` covers `isWorkoutRoute` and `shouldSuppressForegroundPrompt` boundary semantics (including `COLD_START_GUARD_MS = 2000`).
- **Quality gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all exit 0 (40 tests).
- **Regression guard:** No rollback of pause/leave/resume behavior from `4dd2f1c` / `bc74ee1` / `a3cc6ef` / `3a82282` / `f57208e`. Helper extraction preserves prior inline logic. LogSheet anchoring fix (`fee1600`) is not touched by pause commits.
- **Non-blocking nits:** `useResumeWorkoutPrompt.test.ts` tests `workoutRoute` helpers (acceptable per ticket, slightly mismatched filename); `todaySplit !== undefined` is redundant; `leaveWorkout` does not clamp before write (corrected on next `loadActiveSession`); Leave handler dismisses only the cancel sheet, not other open sheets (edge case only).

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates passed locally: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; Vitest reports 40 tests passing.
- Acceptance criteria have static diff evidence in `app/workout/[splitId].tsx`, `app/(tabs)/index.tsx`, `src/features/workout/store/workoutStore.ts`, `src/features/workout/hooks/useResumeWorkoutPrompt.ts`, and `src/features/workout/lib/workoutRoute.ts`.
- Store tests cover `leaveWorkout`, `goToExercise` index persistence, `loadActiveSession` restore/clamp behavior, and `abandonWorkout` reset in `src/features/workout/__tests__/workoutStore.test.ts`.
- Prompt guard pure helpers are covered in `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts`.
- Regression guard checked against the recent paused-workout, finish-confirmation, and LogSheet commits; no undo/regression found.
- Manual-only UI/device checks, including visual sheet behavior, tap targets, backgrounding on a real device, and keyboard/modal feel, are deferred to manual QA per CLI orchestrator rules.

---

# Pass 3 (pass3_security)

Now I have a thorough view of all the relevant files. Let me compile the security review.

---

## Verdict

PASS

## Findings

- **Secrets / credentials**: No API keys, tokens, or credentials present anywhere in the changed files. The Zustand `devtools` middleware is correctly gated behind `process.env.APP_ENV === 'development'` (`workoutStore.ts` line 203), so Redux DevTools are disabled in production builds.

- **AsyncStorage key namespace**: All storage keys are centralised in `src/storage/keys.ts` as `const` strings with consistent prefixes (`sessions:`, `prefs:`). No new keys were added by this feature; `ACTIVE_SESSION` (`sessions:active`) was already in use.

- **JSON.parse without runtime schema validation**: `getActiveSession()` and `getSessions()` both cast the parsed value with `as WorkoutSession` / `as WorkoutSession[]` and no runtime shape check (lines 74, 41 of `sessions.ts`). This is a pre-existing pattern throughout the adapter layer and not introduced by this diff. Risk is low because the data source is the device's own local AsyncStorage (no network origin), but worth noting.

- **AsyncStorage write failure handling**: `setActiveSession`, `clearActiveSession`, and `saveSession` all `throw` on error. Silent-swallow is confined to read paths (`getActiveSession`, `getSessions`), which is the correct asymmetry. The store's `loadActiveSession` correctly protects against a transient `null` read overwriting a valid in-memory session (`if (current && !stored) { ... return; }`, store line 46–49).

- **Fire-and-forget persist in `goToExercise`**: `void setActiveSession(updated)` (store line 143) — errors are silently dropped. This was a deliberate design choice (index navigation should not block UI), and the worst outcome is a stale stored index on the next cold start, which is clamped on load. Not a security issue, and pre-existing behaviour.

- **Route injection / path traversal**: `router.push('/workout/${splitId}')` and `router.replace('/workout/${storeSession.splitId}')` consume `splitId` values originating from locally stored session data (not from a remote source). In a React Native / Expo Router context there is no web-URL injection or XSS vector. An invalid `splitId` would simply render the workout screen in an error/empty bootstrap state.

- **Alert message injection**: `splitName` from the stored session is interpolated into `Alert.alert` messages (e.g., `You have an unfinished ${splitName} workout.`). `Alert.alert` renders via the native OS dialog, not a WebView, so there is no HTML/script injection surface.

- **Cold-start duplicate-prompt guard**: `coldStartPromptAtRef` + `shouldSuppressForegroundPrompt` with `COLD_START_GUARD_MS = 2000` correctly prevents a double prompt on cold-start + immediate foreground. The `alertVisibleRef` mutex also prevents stacking. The `onDismiss` callback resets the ref so the lock cannot get permanently stuck.

- **`substituteExercise` input trimming**: User-supplied exercise name is trimmed (`substituteName.trim()`, store line 147) before use. No additional sanitisation is needed in a native context.

- **Direct `AsyncStorage` call in workout screen**: `AsyncStorage.getItem/setItem(STORAGE_KEYS.HAS_SEEN_SWIPE_HINT, ...)` is called directly on lines 203 / 210 of `[splitId].tsx`, bypassing the adapter layer. This is a boolean hint flag with no security sensitivity.

- **No regression on prior commits**: `leaveWorkout` persists the session without clearing it (confirmed by unit test `leaveWorkout retains session in storage`), which is the correct behaviour described in commits `f57208e` through `3a82282`. `abandonWorkout` still calls `clearActiveSession` — no regression on the Discard path.
## Run 2026-06-29T03:41:57.592Z

Artifacts: `tickets/20260628-225759`

### Ticket
## Title

Paused workout: leave to browse, resume from Home, and return-to-workout prompt

## Context

During an active workout, users are on `app/workout/[splitId].tsx` with no supported way to pause and browse the rest of the app (tabs, cycle, splits, progress). The cancel affordance currently centers on **Discard Workout**, which clears the in-progress session.

The app already persists a single active session via `STORAGE_KEYS.ACTIVE_SESSION` in `src/storage/adapters/sessions.ts` and exposes it through `useWorkoutStore`. We need an explicit **Leave Workout** (pause) path that keeps that session, plus discoverable resume entry points on Home and when returning to the app.

**Response mode:** Standard ceremony (multi-file feature: store + UI + hook).

## Goal

Let users pause an in-progress workout, browse the app freely, and resume later from Home or via the familiar “Resume Workout?” prompt when returning to the app—without losing logged sets or current exercise position.

## Non-goals

- Persisting rest-timer state across leave/background (timer may reset on resume).
- Supporting multiple simultaneous paused workouts (still one `ACTIVE_SESSION` max).
- Adding resume CTAs on every tab screen (Home only, per request).
- Changing workout history export/backup behavior.
- Refactoring unrelated workout UI (log sheet, swipe navigation, finish flow).

## Requirements

1. **Leave (pause) from workout screen**
   - From the workout cancel/exit affordance, offer **Leave Workout** distinct from **Discard Workout**.
   - Leave must persist the active session (sets, split, `currentExerciseIndex`) and navigate to tabs without clearing storage.
   - Discard must continue to clear the active session.

2. **Resume from Home**
   - When `useWorkoutStore.session !== null` (paused active session), Home (`app/(tabs)/index.tsx`) shows a primary **Resume {splitName}** action.
   - If the paused split is today’s scheduled split, replace **Start Workout** with **Resume** in the TODAY card.
   - If the paused split is not today’s split, show a dedicated paused-workout card above TODAY with the same resume action.
   - Tapping resume navigates to `/workout/{splitId}` and restores the saved exercise index.

3. **Resume on app return**
   - When a paused session exists and the user is not already on a workout route, show the familiar `Alert.alert('Resume Workout?', ...)` with **Discard** and **Resume** on:
     - cold start (after loading active session), and
     - foreground return from background/inactive.
   - Do not show the prompt while the user is on `/workout/*`.
   - Avoid duplicate prompts on cold start + immediate foreground (debounce/guard).

4. **Resume bootstrap on workout screen**
   - Opening `/workout/{splitId}` with a matching active session must **not** call `startWorkout` again; restore in-place.
   - Opening a different split while another session is active must keep the existing conflict alert (Discard / Resume other workout).

5. **Store & persistence**
   - `leaveWorkout` writes `currentExerciseIndex` onto the persisted `WorkoutSession`.
   - `loadActiveSession` restores and clamps `currentExerciseIndex` to valid bounds.
   - `goToExercise` persists index changes to active session storage.

## Acceptance criteria

- [ ] Workout cancel sheet includes **Leave Workout**, **Discard Workout**, and **Keep Going**; Leave navigates to tabs and does not clear `ACTIVE_SESSION`.
- [ ] After Leave, logged sets and current exercise index are unchanged when the user taps **Resume** from Home.
- [ ] Home shows **Resume {splitName}** when a paused session exists (TODAY card when split matches today; separate paused card when it does not).
- [ ] Home does not show **Start Workout** for today’s split when that split already has a paused session.
- [ ] Resuming from Home opens the workout at the saved exercise index.
- [ ] On app cold start with a paused session (and user not on `/workout/*`), the **Resume Workout?** alert appears once with working Discard and Resume actions.
- [ ] When the app returns from background with a paused session (and user not on `/workout/*`), the same alert appears (not duplicated immediately after cold-start prompt).
- [ ] Navigating to `/workout/{sameSplitId}` with an existing active session resumes without creating a new session id or wiping logged sets.
- [ ] Attempting to start a different split while a paused session exists still prompts to Discard or Resume the existing workout.
- [ ] Unit tests cover `leaveWorkout`, index persistence via `goToExercise`/`loadActiveSession`, and prompt guard logic (pure helpers in `workoutRoute.ts`).

## Edge cases

- **Stale exercise index:** split edited after pause (exercises removed)—clamp index on load; never crash.
- **In-memory vs storage race:** `loadActiveSession` should not overwrite a valid in-memory session with `null` from a transient read failure.
- **Leave during open bottom sheets:** dismiss sheets and reset rest timer before navigation; no orphan modals on return.
- **Discard from global prompt:** clears session everywhere (Home resume card disappears).
- **Resume while already on Home resume card:** idempotent navigation to same route.
- **Rest day + paused non-today workout:** paused card still visible; TODAY shows rest UI independently.
- **User dismisses alert without choosing:** session remains paused; Home resume still available.

## Implementation notes

**Store & types**

- `src/features/workout/store/workoutStore.ts` — add/verify `leaveWorkout()` (persist session + `currentExerciseIndex`, do not clear). Ensure `goToExercise`, `loadActiveSession`, `abandonWorkout`, and `finishWorkout` align with pause/resume.
- `src/features/workout/types.ts` — ensure `WorkoutSession` includes optional `currentExerciseIndex` for backward compatibility with stored sessions.
- `src/storage/adapters/sessions.ts` — no schema change; continue using `getActiveSession` / `setActiveSession` / `clearActiveSession`.

**Workout screen**

- `app/workout/[splitId].tsx`:
  - Add **Leave Workout** handler: call `leaveWorkout()`, reset rest timer, dismiss cancel sheet, then `router.replace('/(tabs)')`.
  - Bootstrap `init()`: if stored session `splitId` matches route param, set ready without calling `startWorkout`.
  - Keep existing conflict alert when route split ≠ active session split.

**Home resume UI**

- `app/(tabs)/index.tsx`:
  - Call `loadActiveSession` on mount.
  - Derive `pausedForTodaySplit` and `showPausedResumeCard` from `session` + cycle today split.
  - Wire **Resume {splitName}** to `router.push(\`/workout/${session.splitId}\`)`.

**App-return prompt**

- `src/features/workout/hooks/useResumeWorkoutPrompt.ts` — cold-start + `AppState` foreground prompt; skip on `/workout/*`; debounce/guard against duplicate cold-start + foreground prompts; call `loadActiveSession` before first prompt.
- `app/_layout.tsx` — mount `useResumeWorkoutPrompt()` at root layout.
- `src/features/workout/index.ts` — export hook.

**Shared route helpers**

- `src/features/workout/lib/workoutRoute.ts` — `isWorkoutRoute(pathname)`, `shouldSuppressForegroundPrompt(...)`, `COLD_START_GUARD_MS` for hook + tests.

**Tests**

- Extend `src/features/workout/__tests__/workoutStore.test.ts` — `leaveWorkout`, `goToExercise` index persistence, `loadActiveSession` restore/clamp, `abandonWorkout` reset.
- Add/extend `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` — route guard and cold-start suppression boundaries.

## Test plan

**Automated (required gates):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual QA (UI):**

1. Start a workout, log at least one set, swipe to exercise 2, tap cancel → **Leave Workout** → land on Home tabs.
2. Confirm Home shows **Resume {splitName}**; tap it → workout opens on exercise 2 with sets intact.
3. Leave again; background the app (or force-quit), reopen → **Resume Workout?** alert appears; **Resume** returns to workout; repeat with **Discard** and confirm Home no longer shows resume.
4. Pause today’s split workout → Home TODAY card shows **Resume** instead of **Start Workout**.
5. Pause a non-today split → dedicated paused card appears above TODAY.
6. With paused session, tap a different split from **All Splits** → conflict alert still offers Discard / Resume existing workout.
7. While on the workout screen, background and foreground the app → no resume alert on the workout route.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — Diff touches only `app/workout/[splitId].tsx` and `src/features/workout/__tests__/workoutStore.test.ts`. Both changes map directly to ticket edge cases (dismiss open sheets on leave; in-memory vs storage race on `loadActiveSession`). No unrelated files or feature creep.
- **Minimal diff** — Four dismiss calls in `handleLeaveWorkout` plus one focused unit test. No full-file rewrites or drive-by refactors.
- **AGENTS.md patterns** — Leave flow still uses the Zustand store (`leaveWorkout`) and storage adapters; no raw AsyncStorage in the screen. New store behavior is covered by tests, matching the “do not skip tests for store logic” rule.
- **Sheet dismiss completeness** — All five bottom-sheet refs in the workout screen (`cancel`, `log`, `overview`, `substitute`, `finish`) are dismissed before navigation, matching the ticket’s “no orphan modals on return” requirement and the existing `ref.current?.dismiss()` pattern.
- **Leave handler order** — Dismiss sheets → `resetRestTimer()` → `await leaveWorkout()` → `router.replace('/(tabs)')` matches the implementation notes (persist session, reset timer, then navigate).
- **Store race guard** — `loadActiveSession` already guards with `if (current && !stored) return;` (lines 46–48 in `workoutStore.ts`). The new test correctly asserts in-memory session/index are preserved when storage returns `null`.
- **Regression guard** — Diff does not undo paused-workout behavior from recent commits (leave/resume, Home CTAs, app-return prompt, conflict alert, resume bootstrap). It hardens two documented edge cases only.
- **Broader feature (committed baseline)** — Leave/Discard/Keep Going cancel sheet, Home resume UI, `useResumeWorkoutPrompt` with route guard and cold-start suppression, and matching-split bootstrap without `startWorkout` remain intact.
- **Quality gates** — `npm run typecheck`, `npm run lint`, and `npm run test` all pass (41 tests).
- **Observation (non-blocking)** — `handleDiscard` still dismisses only the cancel sheet; the new dismiss-all behavior is scoped to leave. That asymmetry predates this diff and is outside the ticket’s leave-path edge case.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0 with 41 tests passing.
- `app/workout/[splitId].tsx` shows `Leave Workout`, `Discard Workout`, and `Keep Going`; Leave preserves the active session, resets rest timer, dismisses open sheets, and navigates to tabs.
- Store evidence in `workoutStore.ts` covers `leaveWorkout`, `goToExercise` persistence, `loadActiveSession` index restore/clamp, and retaining valid in-memory session when storage returns `null`.
- Home resume ACs are covered in `app/(tabs)/index.tsx`: today split uses Resume instead of Start, non-today paused sessions show a paused card, and resume routes to `/workout/{splitId}`.
- App-return prompt evidence is present in `useResumeWorkoutPrompt.ts`, mounted from `app/_layout.tsx`, with route suppression and cold-start foreground debounce helpers tested in `useResumeWorkoutPrompt.test.ts`.
- Regression guard: the pending diff only adds sheet dismissal on Leave and a storage race test; it does not undo the recent paused workout, finish confirmation, or LogSheet behavior commits.
- Deferred to manual QA: visual/tap behavior of the cancel sheet, Home cards, and native app background/foreground alert presentation.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets in diff.** No `.env` references, API keys, tokens, or credentials appear in either changed file. The Zustand `devtools` middleware is correctly gated on `process.env.APP_ENV === 'development'`.

- **AsyncStorage reads — active session.** `getActiveSession()` does `JSON.parse(raw) as WorkoutSession` (type assertion, no runtime schema validation). This is pre-existing and not introduced by the diff. The `catch` block returns `null` on any parse failure, and `loadActiveSession` in the store further guards the result: it preserves the in-memory session when storage returns `null`, and clamps `currentExerciseIndex` to valid array bounds. The new test (`keeps in-memory session when storage returns null`) correctly exercises the in-memory guard. No regressions introduced here.

- **`splitId` used in template-literal navigation.** Both `router.replace(\`/workout/${storeSession.splitId}\`)` (workout screen, line 177) and `router.push(\`/workout/${splitId}\`)` (prompt hook) build routes from a value read out of AsyncStorage. The `splitId` is always written by the app itself via `startWorkout` → `generateId()`, never from user-typed input or a network response. Expo Router resolves these as relative segments within the app's own navigation tree. Risk is negligible.

- **User input sanitization.** `substituteExercise` trims the substitute name before persisting it. The notes, reps, weight, and RPE inputs flow through `logSet` — unchanged by this diff — and are stored locally with no server persistence or injection surface.

- **No `eval`, dynamic `require`, or shell commands.** None present in the diff or in any file touched.

- **No file paths from a document/file picker.** Not in scope for this diff.

- **Diff-specific changes (`[splitId].tsx`).** The four added `.dismiss()` calls (`logSheetRef`, `overviewSheetRef`, `substituteSheetRef`, `finishSheetRef`) in `handleLeaveWorkout` are purely UI cleanup — no data flow, no storage write, no security surface.

- **New test (`workoutStore.test.ts`).** The added test is pure in-memory state manipulation; it introduces no mock that could mask a security boundary.

- **Regression guard.** None of the commits in the guard list describe behaviour that the diff undoes. `leaveWorkout` still writes the session to storage; `abandonWorkout` still clears it; the conflict alert is still present for mismatched `splitId`.

## Required fixes

_(none — verdict is PASS)_
