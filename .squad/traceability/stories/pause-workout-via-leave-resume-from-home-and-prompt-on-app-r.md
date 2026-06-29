# Pause workout via Leave, resume from Home, and prompt on app return
## Run 2026-06-29T06:20:09.181Z

Artifacts: `tickets/20260629-021509`

### Ticket
## Title

Pause workout via Leave, resume from Home, and prompt on app return

## Context

During an active workout, users often need to check splits, history, or settings without finishing or discarding progress. Today the workout screen blocks accidental exit (back gesture / hardware back) and offers a cancel sheet with **Discard Workout**, **Leave Workout**, and **Keep Going**.

**Leave Workout** should behave as an explicit pause: persist the in-progress session (including exercise index and logged sets), mark it paused, and return the user to the tab navigator so they can browse freely.

When a paused session exists, Home should surface a clear **Resume** affordance. If the user backgrounds or kills the app while paused, returning should show the existing **Resume Workout?** alert (Discard / Resume) — matching the pattern already wired in the root layout hook.

Partial scaffolding exists on `feat/workout-enhancements` (`leaveWorkout`, `pausedAt`, `PausedWorkoutResumeCard`, `useResumeWorkoutPrompt`). This ticket delivers and verifies the full end-to-end UX.

**Response mode:** Standard

## Goal

Let users intentionally pause an active workout, browse the app, resume from Home, and get a resume prompt when reopening the app — without losing in-progress session data.

## Non-goals

- Auto-pausing when the app backgrounds without the user choosing **Leave Workout**
- Resume banners or buttons on non-Home tabs (History, Splits, Settings)
- Changing finish-workout or discard-workout semantics beyond what Leave requires
- Migrating or prompting for legacy incomplete sessions that lack `pausedAt` (only explicit Leave sets pause)
- Refactoring workout store, navigation, or storage adapters beyond what this flow needs

## Requirements

1. **Leave = pause**
   - From the workout cancel sheet, **Leave Workout** must:
     - Persist the active session to AsyncStorage (via `setActiveSession`)
     - Set `pausedAt` and save `currentExerciseIndex`
     - Stop/reset any active rest timer
     - Navigate to `/(tabs)` without clearing session data
   - While a session is **not** paused, back navigation (stack back + Android hardware back) must still be intercepted and show the cancel sheet — not silently exit.

2. **Resume from Home**
   - Home (`app/(tabs)/index.tsx`) must load the active session on mount.
   - When `hasPausedSession(session)` is true:
     - If the paused split matches **today’s** cycle split: replace the Today card **Start Workout** CTA with **Resume {splitName}**.
     - Otherwise (rest day, different split day, or paused split not on today’s card): show `PausedWorkoutResumeCard` above the Today card with **Resume {splitName}**.
   - Tapping Resume navigates to `/workout/{splitId}`; the workout screen must call `resumeWorkoutEntry(splitId)` to clear `pausedAt` and restore exercise index.

3. **App return prompt**
   - Root layout must mount `useResumeWorkoutPrompt()`.
   - On cold start and when returning from background/inactive to active:
     - Rehydrate via `loadActiveSession()`
     - If `shouldPromptResumeSession(session, pathname)` is true (paused + not on `/workout/*`), show alert: **Resume Workout?** / `You have an unfinished {splitName} workout.` with **Discard** (calls `abandonWorkout`) and **Resume** (navigates to workout route).
   - Do not show the prompt when the user is already on a workout route.
   - Suppress duplicate foreground prompts shortly after a cold-start prompt (`shouldSuppressForegroundPrompt` guard).

4. **Conflict handling (unchanged behavior, must not regress)**
   - Starting a different split while an incomplete session exists must still show the existing **Unfinished Workout** alert (Discard / Resume).
   - Only sessions with explicit `pausedAt` count as “paused” for Home resume UI and app-return prompts.

## Acceptance criteria

- [ ] During an active (non-paused) workout, attempting to leave via back/hardware back opens the cancel sheet instead of exiting immediately.
- [ ] **Leave Workout** saves the session with `pausedAt`, preserves logged sets and `currentExerciseIndex`, resets the rest timer, and navigates to Home tabs.
- [ ] After leaving, the user can switch Home / Splits / History / Settings tabs without being forced back into the workout screen.
- [ ] When a paused session matches today’s cycle split, Home Today card shows **Resume {splitName}** instead of **Start Workout**.
- [ ] When a paused session does not match today’s card (including rest days), Home shows `PausedWorkoutResumeCard` with a working Resume button.
- [ ] Tapping Resume on Home opens the workout at the saved exercise index with `pausedAt` cleared.
- [ ] After pausing and backgrounding/killing the app, reopening while off a workout route shows **Resume Workout?** with Discard and Resume actions.
- [ ] No resume prompt appears when the user is on `/workout/{splitId}`.
- [ ] **Discard Workout** from the cancel sheet or app-return alert clears the active session; Home resume UI and prompts disappear.
- [ ] Completing a workout clears pause state; no resume UI or prompts remain for that session.

## Edge cases

- **Paused split ≠ today’s cycle day:** Resume card appears; starting today’s workout still triggers the unfinished-workout conflict alert.
- **Rest day with paused workout:** `PausedWorkoutResumeCard` is shown; Today card remains rest-day UI.
- **Cold start + immediate foreground:** Foreground prompt is suppressed within `COLD_START_GUARD_MS` after cold-start prompt.
- **Rapid double alert:** `alertVisibleRef` prevents stacking multiple Resume alerts.
- **Stale exercise index** (split edited while paused): `resumeWorkoutEntry` / `loadActiveSession` clamp index to valid range.
- **Legacy incomplete session without `pausedAt`:** No Home pause UI and no app-return prompt; existing conflict alert on starting another workout still applies.
- **User resumes then leaves again:** New `pausedAt` overwrites; session data remains consistent.

## Implementation notes

**Store & types**

- `src/features/workout/store/workoutStore.ts` — verify/implement `leaveWorkout` (set `pausedAt`, persist index) and `resumeWorkoutEntry` (clear `pausedAt`, restore/clamp index); ensure `loadActiveSession` rehydrates paused sessions.
- `src/features/workout/types.ts` — `pausedAt?: number` on `WorkoutSession`.

**Workout screen**

- `app/workout/[splitId].tsx`:
  - Cancel sheet actions: **Leave Workout** → `leaveWorkout()` + `router.replace('/(tabs)')`; set `isLeavingIntentionallyRef` before navigate.
  - `beforeRemove` / `BackHandler` guards only when `session.pausedAt == null`.
  - Bootstrap: if stored session matches `splitId`, call `resumeWorkoutEntry(splitId)` before rendering.

**Home resume UI**

- `app/(tabs)/index.tsx` — load session; branch Today CTA vs `PausedWorkoutResumeCard` using `hasPausedSession`, `pausedMatchesToday`; `router.push(/workout/${splitId})` on resume.
- `src/features/workout/components/PausedWorkoutResumeCard.tsx` — paused banner + Resume button (reuse existing styling/typography patterns).

**App-return prompt**

- `src/features/workout/hooks/useResumeWorkoutPrompt.ts` — cold-start + `AppState` foreground handling, alert copy/actions.
- `src/features/workout/lib/workoutRoute.ts` — `hasPausedSession`, `shouldPromptResumeSession`, `shouldSuppressForegroundPrompt`, `isWorkoutRoute`.
- `app/_layout.tsx` — mount `useResumeWorkoutPrompt()`.

**Persistence**

- `src/storage/adapters/sessions.ts` — `getActiveSession` / `setActiveSession` / `clearActiveSession` (no raw AsyncStorage in components).

**Exports**

- `src/features/workout/index.ts` — export hook, card, and route helpers used by screens.

**Tests (required for store/route logic)**

- `src/features/workout/__tests__/workoutStore.test.ts` — `leaveWorkout`, `resumeWorkoutEntry`, `loadActiveSession` paused rehydration.
- `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` — route/prompt predicate unit tests (hook behavior covered indirectly via lib helpers).

Keep diffs incremental; match existing NativeWind + `textRoles` patterns on Home and the cancel sheet.

## Test plan

**Automated (required gates):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual QA (UI flows):**

1. Start a workout, log at least one set, open cancel sheet → **Leave Workout** → confirm landing on Home and session persisted.
2. From Home, confirm Resume CTA (Today card or `PausedWorkoutResumeCard` depending on cycle day) → verify correct exercise index and cleared pause state.
3. Leave workout again, background the app (or force-quit), reopen → confirm **Resume Workout?** alert; test both Resume and Discard paths.
4. While on the workout screen after resume, confirm back gesture is blocked again until Leave or Discard.
5. Browse Splits / History / Settings after pausing — no forced navigation back to workout (only Home shows resume button).
6. Complete the workout — confirm resume UI and prompts no longer appear.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Ticket scope (pause slice):** Pause-specific work is concentrated in the expected areas — `leaveWorkout` / `resumeWorkoutEntry` / `loadActiveSession` in `workoutStore.ts`, route predicates in `workoutRoute.ts`, `useResumeWorkoutPrompt` in root layout, Home resume branching, and `PausedWorkoutResumeCard`. No unrelated feature modules were added for pause.
- **Branch scope note:** `app/workout/[splitId].tsx` also carries `FinishWorkoutSheet` work from an earlier branch commit (`8f01bb5`). That is out of this ticket’s non-goals, but the pause additions in that file (Leave handler, `beforeRemove` / `BackHandler` guards, `resumeWorkoutEntry` bootstrap, intentional-leave ref) are incremental and ticket-aligned.
- **AGENTS.md patterns:** State changes go through the Zustand store and `sessions` storage adapter (`setActiveSession` / `getActiveSession`); no new raw AsyncStorage usage for session data. Home and pause UI use NativeWind + `textRoles`. Required store/route tests are present and passing.
- **Requirement 1 (Leave = pause):** `leaveWorkout` sets `pausedAt`, persists `currentExerciseIndex`, and does not clear storage. `handleLeaveWorkout` resets the rest timer, sets `isLeavingIntentionallyRef`, and `router.replace('/(tabs)')`. Back/stack exit is intercepted via `beforeRemove` and Android `BackHandler` only when `session.pausedAt == null`.
- **Requirement 2 (Resume from Home):** Home loads the active session on mount, branches Today CTA vs `PausedWorkoutResumeCard` with `hasPausedSession` / today-split matching, and navigates to `/workout/{splitId}`. Workout bootstrap calls `resumeWorkoutEntry(splitId)` for a matching stored session, clearing `pausedAt` and restoring/clamping index.
- **Requirement 3 (App return prompt):** `useResumeWorkoutPrompt()` is mounted in `app/_layout.tsx`. Cold start and foreground return rehydrate via `loadActiveSession()`, gate on `shouldPromptResumeSession`, suppress duplicates with `shouldSuppressForegroundPrompt` / `alertVisibleRef`, and skip on workout routes.
- **Requirement 4 (Conflict handling):** Home `startWorkoutForSplit` still uses `isIncompleteActiveSession` for the **Unfinished Workout** alert. Only `pausedAt` sessions drive Home pause UI and app-return prompts (`hasPausedSession`), preserving legacy incomplete-session behavior.
- **Regression guard:** Recent pause commits’ behavior is present — Leave persists pause state, Home resume affordances work, app-return prompt is centralized (Home’s old unpause-gated crash alert was correctly removed), and conflict/resume bootstrap now navigates to the stored split instead of incorrectly marking ready in place.
- **Minimal diff / naming:** Pause changes are localized edits, not full rewrites. Naming (`leaveWorkout`, `resumeWorkoutEntry`, `hasPausedSession`, `PausedWorkoutResumeCard`) matches surrounding feature conventions.
- **TypeScript:** No new unjustified `any` in pause-related code. Gates reported clean: typecheck, lint, and 56 tests passing (including 14 store + 14 route/prompt predicate tests).
- **Pre-existing nit (non-blocking):** `app/workout/[splitId].tsx` still uses raw `AsyncStorage` for the swipe-hint flag — predates this ticket and unchanged by pause work.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Checked automated gates from the provided run: `npm run typecheck`, `npm run lint`, and `npm run test` all passed; 56 Vitest tests passed.
- Store pause/resume behavior has unit coverage in `src/features/workout/__tests__/workoutStore.test.ts` for `leaveWorkout`, `resumeWorkoutEntry`, paused rehydration, stale index clamping, abandon, and finish cleanup.
- Route/prompt helper logic has unit coverage in `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts`, including paused-only prompts, workout-route suppression, legacy incomplete sessions, and cold-start foreground guard.
- Static evidence satisfies the ACs: Leave sets `pausedAt`, persists `currentExerciseIndex`, preserves session data, resets rest timer, and routes to `/(tabs)`; Home renders resume CTA/card based on today’s split; workout bootstrap clears `pausedAt` and restores index.
- App-return prompt is mounted in `app/_layout.tsx`, reloads active session on cold start/foreground, suppresses prompts on `/workout/*`, prevents duplicate alerts, and wires Discard/Resume actions.
- Conflict handling is preserved: starting a different split with any incomplete active session still shows the existing `Unfinished Workout` alert, while Home/app-return resume UI only uses explicit `pausedAt`.
- Regression guard against the listed recent commits passed; I did not find evidence that pause-to-browse, Home resume, app-return prompt, discard, or completion cleanup behavior was undone.
- Deferred to manual QA: physical/device confirmation of back gesture and Android hardware back interception, tab browsing feel after Leave, app background/kill alert display, and full tap-through Home Resume/Discard/Complete flows.

---

# Pass 3 (pass3_security)

## Verdict
PASS

## Findings

- **No secrets in diff** — `.env.development` and `.env.production` are tracked by git (`.gitignore` only excludes `.env*.local`), but both files contain only `APP_ENV` discriminator values — no API keys, tokens, or credentials. The workout feature files introduce no new secrets.

- **AsyncStorage data validated on read** — `getActiveSession()` in `src/storage/adapters/sessions.ts` (line 74) parses JSON and casts directly with `as WorkoutSession` — a TypeScript assertion, not a runtime guard. Structural invariants (`exercises` being an array, numeric fields like `pausedAt` being numbers) are not validated before use. Mitigating factors: the store's `loadActiveSession` wraps everything in try-catch and sets error state on throw; `currentExerciseIndex` is clamped after read; this is sandboxed local-only storage with no external write vectors; and the same pattern exists throughout `getSessions()` / `saveSessions()` (pre-existing, not introduced by this diff). Risk is low-severity.

- **User input sanitized where persisted** — `substituteExercise` calls `.trim()` on the exercise name before storing (line 148 in `workoutStore.ts`). Alert and UI strings use `splitName` and `splitId` from session objects written by the app itself — no raw unguarded user input flows directly to storage.

- **No unsafe patterns** — No `eval`, `new Function()`, dynamic `require()`, or shell command invocations anywhere in the diff surface. Expo Router path parameters (`/workout/${splitId}`) originate from stored split IDs, not free-form user text.

- **File paths / document picker** — Not applicable; no file picker or document import path introduced.

- **`!` non-null assertions in `useResumeWorkoutPrompt`** — `s!.splitId` / `s!.splitName` at lines 69 and 96 are logically sound: both are reached only after `shouldPromptResumeSession(s, ...)` returns true, which requires `hasPausedSession(s)` → `isIncompleteActiveSession(s)` → `s !== null`. Not a runtime risk.

- **Direct `AsyncStorage` in workout component** — `app/workout/[splitId].tsx` imports and calls `AsyncStorage` directly for the `HAS_SEEN_SWIPE_HINT` flag (lines 233 and 240). The implementation notes say "no raw AsyncStorage in components" for *session* adapters; this usage is a UI-preference flag untouched by this diff and is pre-existing behaviour, not a session-data concern.

- **Regression guard** — All listed commits relate to `leaveWorkout`, `pausedAt`, home resume CTA, and app-return prompt. The diff correctly implements `leaveWorkout` (sets `pausedAt`, persists index), `resumeWorkoutEntry` (strips `pausedAt`, clamps index), `beforeRemove`/`BackHandler` guards conditioned on `session.pausedAt == null`, and `useResumeWorkoutPrompt` in the root layout. No described behaviour is undone.
## Run 2026-06-29T06:40:52.795Z

Artifacts: `tickets/20260629-023415`

### Ticket
## Title

Pause workout via Leave, resume from Home, and prompt on app return

## Context

During an active workout, users often need to check splits, history, or settings without finishing or discarding progress. The workout screen already blocks accidental exit (stack back + Android hardware back) and shows a cancel sheet with **Discard Workout**, **Leave Workout**, and **Keep Going**.

**Leave Workout** should behave as an explicit pause: persist the in-progress session (logged sets, exercise index), mark it paused, and return the user to the tab navigator so they can browse freely.

When a paused session exists, Home should surface a clear **Resume** affordance. If the user backgrounds or kills the app while paused, returning should show the familiar **Resume Workout?** alert (Discard / Resume) — wired via the root layout hook.

Partial scaffolding exists on `feat/workout-enhancements` (`leaveWorkout`, `pausedAt`, `PausedWorkoutResumeCard`, `useResumeWorkoutPrompt`). This ticket delivers and verifies the full end-to-end UX.

**Response mode:** Standard

## Goal

Let users intentionally pause an active workout, browse the app, resume from Home, and get a resume prompt when reopening the app — without losing in-progress session data.

## Non-goals

- Auto-pausing when the app backgrounds without the user choosing **Leave Workout**
- Resume banners or buttons on non-Home tabs (History, Splits, Settings)
- Changing finish-workout or discard-workout semantics beyond what Leave requires
- Migrating or prompting for legacy incomplete sessions that lack `pausedAt` (only explicit Leave sets pause)
- Refactoring workout store, navigation, or storage adapters beyond what this flow needs

## Requirements

1. **Leave = pause**
   - From the workout cancel sheet, **Leave Workout** must:
     - Persist the active session to AsyncStorage (via `setActiveSession`)
     - Set `pausedAt` and save `currentExerciseIndex`
     - Stop/reset any active rest timer
     - Navigate to `/(tabs)` without clearing session data
   - While a session is **not** paused, back navigation (stack back + Android hardware back) must still be intercepted and show the cancel sheet — not silently exit.

2. **Resume from Home**
   - Home (`app/(tabs)/index.tsx`) must load the active session on mount.
   - When `hasPausedSession(session)` is true:
     - If the paused split matches **today’s** cycle split: replace the Today card **Start Workout** CTA with **Resume {splitName}**.
     - Otherwise (rest day, different split day, or paused split not on today’s card): show `PausedWorkoutResumeCard` above the Today card with **Resume {splitName}**.
   - Tapping Resume navigates to `/workout/{splitId}`; the workout screen must call `resumeWorkoutEntry(splitId)` to clear `pausedAt` and restore exercise index.

3. **App return prompt**
   - Root layout must mount `useResumeWorkoutPrompt()`.
   - On cold start and when returning from background/inactive to active:
     - Rehydrate via `loadActiveSession()`
     - If `shouldPromptResumeSession(session, pathname)` is true (paused + not on `/workout/*`), show alert: **Resume Workout?** / `You have an unfinished {splitName} workout.` with **Discard** (calls `abandonWorkout`) and **Resume** (navigates to workout route).
   - Do not show the prompt when the user is already on a workout route.
   - Suppress duplicate foreground prompts shortly after a cold-start prompt (`shouldSuppressForegroundPrompt` guard).

4. **Conflict handling (unchanged behavior, must not regress)**
   - Starting a different split while an incomplete session exists must still show the existing **Unfinished Workout** alert (Discard / Resume).
   - Only sessions with explicit `pausedAt` count as “paused” for Home resume UI and app-return prompts.

## Acceptance criteria

- [ ] During an active (non-paused) workout, attempting to leave via back/hardware back opens the cancel sheet instead of exiting immediately.
- [ ] **Leave Workout** saves the session with `pausedAt`, preserves logged sets and `currentExerciseIndex`, resets the rest timer, and navigates to Home tabs.
- [ ] After leaving, the user can switch Home / Splits / History / Settings tabs without being forced back into the workout screen.
- [ ] When a paused session matches today’s cycle split, Home Today card shows **Resume {splitName}** instead of **Start Workout**.
- [ ] When a paused session does not match today’s card (including rest days), Home shows `PausedWorkoutResumeCard` with a working Resume button.
- [ ] Tapping Resume on Home opens the workout at the saved exercise index with `pausedAt` cleared.
- [ ] After pausing and backgrounding/killing the app, reopening while off a workout route shows **Resume Workout?** with Discard and Resume actions.
- [ ] No resume prompt appears when the user is on `/workout/{splitId}`.
- [ ] **Discard Workout** from the cancel sheet or app-return alert clears the active session; Home resume UI and prompts disappear.
- [ ] Completing a workout clears pause state; no resume UI or prompts remain for that session.

## Edge cases

- **Paused split ≠ today’s cycle day:** Resume card appears; starting today’s workout still triggers the unfinished-workout conflict alert.
- **Rest day with paused workout:** `PausedWorkoutResumeCard` is shown; Today card remains rest-day UI.
- **Cold start + immediate foreground:** Foreground prompt is suppressed within `COLD_START_GUARD_MS` after cold-start prompt.
- **Rapid double alert:** `alertVisibleRef` prevents stacking multiple Resume alerts.
- **Stale exercise index** (split edited while paused): `resumeWorkoutEntry` / `loadActiveSession` clamp index to valid range.
- **Legacy incomplete session without `pausedAt`:** No Home pause UI and no app-return prompt; existing conflict alert on starting another workout still applies.
- **User resumes then leaves again:** New `pausedAt` overwrites; session data remains consistent.

## Implementation notes

**Store & types**

- `src/features/workout/store/workoutStore.ts` — verify/implement `leaveWorkout` (set `pausedAt`, persist index) and `resumeWorkoutEntry` (clear `pausedAt`, restore/clamp index); ensure `loadActiveSession` rehydrates paused sessions.
- `src/features/workout/types.ts` — `pausedAt?: number` on `WorkoutSession`.

**Workout screen**

- `app/workout/[splitId].tsx`:
  - Cancel sheet actions: **Leave Workout** → `leaveWorkout()` + `router.replace('/(tabs)')`; set `isLeavingIntentionallyRef` before navigate.
  - `beforeRemove` / `BackHandler` guards only when `session.pausedAt == null`.
  - Bootstrap: if stored session matches `splitId`, call `resumeWorkoutEntry(splitId)` before rendering.

**Home resume UI**

- `app/(tabs)/index.tsx` — load session; branch Today CTA vs `PausedWorkoutResumeCard` using `hasPausedSession`, `pausedMatchesToday`; `router.push(/workout/${splitId})` on resume.
- `src/features/workout/components/PausedWorkoutResumeCard.tsx` — paused banner + Resume button (reuse existing styling/typography patterns).

**App-return prompt**

- `src/features/workout/hooks/useResumeWorkoutPrompt.ts` — cold-start + `AppState` foreground handling, alert copy/actions.
- `src/features/workout/lib/workoutRoute.ts` — `hasPausedSession`, `shouldPromptResumeSession`, `shouldSuppressForegroundPrompt`, `isWorkoutRoute`.
- `app/_layout.tsx` — mount `useResumeWorkoutPrompt()`.

**Persistence**

- `src/storage/adapters/sessions.ts` — `getActiveSession` / `setActiveSession` / `clearActiveSession` (no raw AsyncStorage in components for session data).

**Exports**

- `src/features/workout/index.ts` — export hook, card, and route helpers used by screens.

**Tests (required for store/route logic)**

- `src/features/workout/__tests__/workoutStore.test.ts` — `leaveWorkout`, `resumeWorkoutEntry`, `loadActiveSession` paused rehydration.
- `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` — route/prompt predicate unit tests (hook behavior covered indirectly via lib helpers).

Keep diffs incremental; match existing NativeWind + `textRoles` patterns on Home and the cancel sheet.

## Test plan

**Automated (required gates):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual QA (UI flows):**

1. Start a workout, log at least one set, open cancel sheet → **Leave Workout** → confirm landing on Home and session persisted.
2. From Home, confirm Resume CTA (Today card or `PausedWorkoutResumeCard` depending on cycle day) → verify correct exercise index and cleared pause state.
3. Leave workout again, background the app (or force-quit), reopen → confirm **Resume Workout?** alert; test both Resume and Discard paths.
4. While on the workout screen after resume, confirm back gesture is blocked again until Leave or Discard.
5. Browse Splits / History / Settings after pausing — no forced navigation back to workout (only Home shows resume button).
6. Complete the workout — confirm resume UI and prompts no longer appear.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Ticket scope:** Pause/resume work stays within the ticket’s file list — `workoutStore.ts` (`leaveWorkout`, `resumeWorkoutEntry`, index clamp/persist), `workoutRoute.ts` helpers, `PausedWorkoutResumeCard`, Home resume branching in `app/(tabs)/index.tsx`, `useResumeWorkoutPrompt` mounted in `app/_layout.tsx`, and cancel-sheet / `beforeRemove` / `BackHandler` wiring in `app/workout/[splitId].tsx`. Latest iteration diff is minimal (+27 lines across four code files: bootstrap ref reset, `pausedAt` guards on exit listeners, `resumeWorkoutEntry` index sync, barrel exports, tests).
- **Branch-level scope creep (informational, not blocking this ticket):** `feat/workout-enhancements` also carries finish-confirmation (`FinishWorkoutSheet`, `WorkoutDatePicker`), LogSheet anchoring, and orchestrator infra from other commits. Those coexist in shared files (notably `[splitId].tsx`) but are separate tickets; the pause slice itself does not add unrelated modules.
- **Regression guard:** No undo of behavior from the listed orchestrator commits. `leaveWorkout` still persists via `setActiveSession` with `pausedAt` (no `clearActiveSession`); Home resume uses `hasPausedSession` (explicit pause only); root `useResumeWorkoutPrompt` handles cold-start + foreground return; conflict alerts still use `isIncompleteActiveSession`. Recent fixes strengthen rather than regress: `resumeWorkoutEntry` prefers stored `currentExerciseIndex`, clamps, and syncs Zustand state; `isLeavingIntentionallyRef` resets on bootstrap so exit guards re-arm after resume; `beforeRemove` / `BackHandler` skip when `session.pausedAt != null`.
- **Requirements alignment:** Leave Workout dismisses sheets, calls `resetRestTimer()`, `leaveWorkout()`, and `router.replace('/(tabs)')`; back/hardware back blocked via cancel sheet when session is active and not paused; Home swaps Today CTA vs `PausedWorkoutResumeCard` based on `pausedMatchesToday`; workout bootstrap calls `resumeWorkoutEntry(splitId)` for matching sessions; app-return prompt rehydrates with `loadActiveSession`, gates on `shouldPromptResumeSession`, suppresses duplicates via `shouldSuppressForegroundPrompt` / `alertVisibleRef`, and skips workout routes.
- **AGENTS.md patterns:** Zustand + storage adapters for session persistence (no raw AsyncStorage for session state); NativeWind `className` + `textRoles` on Home and resume card; barrel exports in `src/features/workout/index.ts`; unit tests for store transitions and pure route guards per anti-pattern guidance. Minor pre-existing deviation: `[splitId].tsx` uses direct `expo-haptics` and raw AsyncStorage for swipe-hint preference only — not introduced by pause logic.
- **TypeScript / naming:** No unjustified `any` in pause/resume code. Naming matches surrounding conventions (`leaveWorkout`, `hasPausedSession`, `shouldPromptResumeSession`, etc.). Non-null assertions in `useResumeWorkoutPrompt` (`s!`) are downstream of `shouldPromptResumeSession` → `hasPausedSession` guards.
- **Tests & gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all pass (56 tests). `workoutStore.test.ts` covers leave/resume/index/clamp/discard/finish including the new index-restore case; `useResumeWorkoutPrompt.test.ts` covers paused-only gating, workout-route suppression, legacy incomplete exclusion, and cold-start foreground guard.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0 with 56 passing tests.
- `leaveWorkout` persists the active session with `pausedAt` and `currentExerciseIndex`; cancel sheet Leave resets the rest timer and routes to `/(tabs)`.
- Non-paused workout back behavior is preserved: stack back and Android hardware back still present the cancel sheet while `pausedAt == null`.
- Home loads active session state and shows either `Resume {splitName}` on today’s card or `PausedWorkoutResumeCard` when the paused split is not today’s card/rest day.
- Resume navigation opens `/workout/{splitId}` and workout bootstrap calls `resumeWorkoutEntry`, which clears `pausedAt` and clamps/restores the saved exercise index.
- Root layout mounts `useResumeWorkoutPrompt`; route helpers cover paused-only prompts, workout-route suppression, cold-start foreground suppression, and duplicate alert prevention.
- Conflict handling remains present: starting another split with any incomplete active session still shows the existing Unfinished Workout alert.
- Required store/route logic has unit coverage in `workoutStore.test.ts` and `useResumeWorkoutPrompt.test.ts`, including paused rehydration, legacy incomplete sessions, stale index clamping, abandon/finish cleanup, and prompt predicates.
- Manual/device-only acceptance criteria, including visual/tap behavior and actual background/force-quit interaction, are deferred to manual QA per orchestrator instructions.
- Regression guard checked against the listed recent commits; current code retains the described pause, Home resume, and app-return prompt behavior.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets in diff** — No API keys, tokens, `.env` references, or hardcoded credentials anywhere in the changed files. `process.env.APP_ENV` is used solely to gate devtools, which is correct.

- **AsyncStorage access is centralised** — All session reads/writes in the new code (`leaveWorkout`, `resumeWorkoutEntry`, `loadActiveSession`) go through the adapter layer (`src/storage/adapters/sessions.ts`). The one direct `AsyncStorage` call remaining in `[splitId].tsx` (swipe-hint flag, lines 233–240) is pre-existing and limited to a boolean UI preference, not session data — within the SKILL.md carve-out.

- **`getActiveSession` parse without structural validation** — `JSON.parse(raw) as WorkoutSession` (sessions.ts line 74) is a bare cast. However, the SKILL.md guard specifically targets "backup/import paths" (external user-supplied data). This path is purely internal app state, is wrapped in a try/catch that returns `null` on error, and no external/user file is imported. Acceptable.

- **User input sanitised where persisted** — `substituteExercise` calls `.trim()` before persisting (workoutStore.ts line 148). Free-text fields (`notes`, `rpeInput`) are stored as-is, but they are only ever displayed back to the same user in native React Native components, so there is no XSS or injection surface.

- **`splitName` in Alert dialogs** — `s!.splitName` is rendered verbatim in `Alert.alert`. The `!` non-null assertion is safe: it is guarded by `shouldPromptResumeSession → hasPausedSession → isIncompleteActiveSession(session)` which enforces `session !== null`. No injection vector in native Alert.

- **`splitId` used in router paths** — `router.push(\`/workout/${splitId}\`)` everywhere. `splitId` originates exclusively from stored `WorkoutSession.splitId`, which is set once at `startWorkout` from a `Split` object loaded from storage — never from raw URL input or user-typed text. No open-redirect or path-traversal risk.

- **No `eval`, dynamic `require`, or shell invocations** — Confirmed absent across all diff files.

- **No file picker or document-picker paths** — Not introduced by this diff.

- **Regression guard** — `leaveWorkout` sets `pausedAt` and persists (does not clear) the session; `resumeWorkoutEntry` clears `pausedAt` and restores index; `useResumeWorkoutPrompt` is mounted in `_layout.tsx`; `beforeRemove`/`BackHandler` guards are conditioned on `session.pausedAt == null`. All behaviours described in commits `4ca4721`–`0b3a382` are intact.
