# Pause workout to browse tabs, resume from Home, and prompt on app return
## Run 2026-06-29T04:13:08.906Z

Artifacts: `tickets/20260629-001002`

### Ticket
## Title

Pause workout to browse tabs, resume from Home, and prompt on app return

## Context

During an active workout, users need to step away from the session screen to browse Home, Splits, History, or Settings without losing logged sets. The workout stack currently blocks accidental exit (back/swipe) via a cancel sheet; **Leave Workout** is the deliberate pause path.

Foundational pieces already exist in the codebase:

- `leaveWorkout()` in `workoutStore` sets `pausedAt` and persists to `sessions:active`
- `PausedWorkoutResumeCard` on Home when `hasPausedSession()` is true
- `useResumeWorkoutPrompt()` mounted in root layout for cold-start and foreground **Resume Workout?** alerts

This ticket ensures the full user journey is wired correctly end-to-end—explicit pause, free tab browsing, Home resume, and app-return prompt—with no false positives for in-progress (non-paused) sessions.

## Goal

Users can explicitly leave (pause) an in-progress workout, browse the tab menu freely, resume from a prominent Home button while paused, and see the familiar **Resume Workout?** alert when returning to the app after leaving.

## Non-goals

- Auto-pausing when the app backgrounds without the user choosing **Leave Workout**
- Resume CTA on tabs other than Home (Splits, History, Settings)
- Persisting or restoring rest-timer state across leave/resume
- Renaming **Leave Workout** to **Pause** in the cancel sheet (unless copy clarity requires it)
- Changing finish/discard flows or history persistence

## Requirements

1. **Leave workout (pause)**
   - The workout cancel/exit sheet must offer **Leave Workout** alongside discard and keep-going options.
   - **Leave Workout** must persist the in-progress session (sets, exercise index, split metadata) via the sessions adapter and set `pausedAt`.
   - After leaving, navigate to `/(tabs)` so the user can browse all tabs without remaining on the workout stack.
   - Accidental back/swipe exit must still be blocked unless the user confirms leave, discard, or finish.

2. **Home resume button**
   - When an active session has `pausedAt` set, Home must show a prominent resume card/button with the split name.
   - Tapping resume navigates to `/workout/[splitId]` and clears `pausedAt` on entry for the matching split via `resumeWorkoutEntry`.
   - The card must not appear for completed sessions or for in-progress sessions that were never explicitly left (no `pausedAt`).

3. **App return prompt**
   - On cold start and when returning from background, if there is a paused active session (`pausedAt` set, `completedAt` null) and the user is not on a workout route, show the existing **Resume Workout?** alert (Resume / Discard).
   - Suppress duplicate prompts on cold start + immediate foreground (debounce/guard).
   - Do not prompt while the user is on `/workout/[splitId]`.

4. **Conflict handling (must not regress)**
   - Starting a different split while a paused or incomplete session exists must still show the unfinished-workout conflict alert (Resume current / Discard).

## Acceptance criteria

- [ ] From an active workout, choosing **Leave Workout** saves progress to active session storage, sets `pausedAt`, and lands the user on the tab menu with free navigation across Home, Splits, History, and Settings.
- [ ] After leaving, Home displays `PausedWorkoutResumeCard` with the correct split name and a working **Resume** action.
- [ ] Tapping **Resume** on Home opens `/workout/[splitId]`, restores exercise index and logged sets, and clears `pausedAt` so the card disappears.
- [ ] After leaving a paused workout and backgrounding or force-quitting the app, reopening shows **Resume Workout?** with the correct split name; **Resume** navigates to the workout and **Discard** clears the active session.
- [ ] No resume prompt appears when the user is already on a workout route, or when there is no paused session (`pausedAt` unset).
- [ ] Swipe/back from the workout screen without confirming leave/discard does not exit the workout or set `pausedAt`.
- [ ] Starting a different split while a paused session exists still blocks with the unfinished-workout conflict flow.
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` all pass.

## Edge cases

- User leaves workout, resumes from Home, leaves again—session updates `pausedAt` each time without data loss.
- User leaves workout, taps **Resume** on Home, then continues—no duplicate prompts or stale Home card.
- Cold start triggers resume alert; immediate foreground event must not show a second alert (guard window via `shouldSuppressForegroundPrompt`).
- Legacy active sessions in storage without `pausedAt` do not show Home resume card or app-return prompt (explicit leave only); conflict alert still applies when starting another workout.
- Active session for split A paused; user attempts split B from Home or Splits—conflict alert, no silent overwrite.
- `loadActiveSession` not yet complete on Home—no flash of wrong UI; resume card appears once session is loaded.
- Android hardware back and iOS swipe-back both route through the same cancel sheet before leave.

## Implementation notes

**Response mode:** Standard ceremony.

**Files to verify, wire, or extend (avoid duplicate implementations):**

| Area | Files |
|------|--------|
| Leave / exit UX | `app/workout/[splitId].tsx` — cancel bottom sheet (**Leave Workout**, `handleLeaveWorkout`, `beforeRemove` / `BackHandler`, `isLeavingIntentionallyRef`) |
| Store & persistence | `src/features/workout/store/workoutStore.ts` — `leaveWorkout`, `resumeWorkoutEntry`, `loadActiveSession`; `src/storage/adapters/sessions.ts` — `getActiveSession` / `setActiveSession` |
| Route helpers | `src/features/workout/lib/workoutRoute.ts` — `hasPausedSession`, `shouldPromptResumeSession`, `shouldSuppressForegroundPrompt`, `isWorkoutRoute`, `isIncompleteActiveSession` |
| Home resume UI | `app/(tabs)/index.tsx` — `loadActiveSession`, `hasPausedSession`, `PausedWorkoutResumeCard`, `handleResumePausedWorkout`, `startWorkoutForSplit` conflict guard; `src/features/workout/components/PausedWorkoutResumeCard.tsx` |
| App-return prompt | `src/features/workout/hooks/useResumeWorkoutPrompt.ts`; mount in `app/_layout.tsx` |
| Types / exports | `src/features/workout/types.ts` (`pausedAt`), `src/features/workout/index.ts` |
| Tests | `src/features/workout/__tests__/workoutStore.test.ts`, `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` |

**Guidance:**

- Extend existing `leaveWorkout` / `pausedAt` flow; do not add new store fields unless required.
- Keep persistence through `sessions:active` adapter only—no raw AsyncStorage in components (except existing swipe-hint flag).
- Ensure Home calls `loadActiveSession()` on mount so the resume card survives app restart.
- Gate Home resume card and app-return prompt on `hasPausedSession` (requires `pausedAt`); use `isIncompleteActiveSession` separately for conflict alerts.
- Match existing typography/haptics patterns (`textRoles`, haptics consistent with adjacent cancel-sheet actions).

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

- Store tests: `leaveWorkout` sets `pausedAt` and persists; `resumeWorkoutEntry` clears `pausedAt` for matching `splitId`; `loadActiveSession` rehydrates paused session.
- Route/prompt tests: `hasPausedSession` true only with `pausedAt`; `shouldPromptResumeSession` false on workout routes and for legacy incomplete-only sessions; `shouldSuppressForegroundPrompt` prevents duplicate cold-start + foreground alerts.

**Manual QA (UI flows):**

1. Start a workout, log at least one set, open cancel sheet → **Leave Workout** → confirm tabs are browsable (visit Splits and Settings).
2. Open Home → verify paused resume card appears with correct split → tap **Resume** → verify exercise index/sets restored and card gone after re-entering.
3. Leave workout again → background app → foreground → verify single **Resume Workout?** alert; test both Resume and Discard.
4. Leave workout → force-quit app → relaunch → verify cold-start prompt (once) with correct split name.
5. While paused, attempt to start a different split → verify conflict alert.
6. On workout screen, attempt swipe/back without sheet confirmation → verify workout is not left and `pausedAt` is unset.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope:** Diff is limited to `src/features/workout/__tests__/workoutStore.test.ts` — one new test. No unrelated files, no production code changes, no scope creep.
- **Ticket alignment:** Matches the ticket test plan (“`loadActiveSession` rehydrates paused session”) and the Home/app-return dependency on rehydrating `pausedAt` after restart.
- **Minimal diff:** +12 lines in an existing `describe`; no rewrites or structural churn.
- **Patterns:** Follows existing test conventions — `makeSession` helper, mocked sessions adapter, `beforeEach` reset, assertions on store state. Naming matches adjacent `loadActiveSession` cases.
- **AGENTS.md:** Complies with “Do not skip tests for new pure functions or store logic”; store tests live under `src/features/workout/__tests__/`.
- **TypeScript:** No new types or `any` escapes; test uses existing `WorkoutSession` typing.
- **Correctness:** Assertions match `loadActiveSession` — it spreads stored session (including `pausedAt`) and restores/clamps `currentExerciseIndex`. Expectations for `pausedAt: 42_000`, `completedAt: null`, and index `1` are accurate.
- **Overlap:** Partial overlap with `loadActiveSession restores stored exercise index`, but the new case adds the ticket-specific `pausedAt` / incomplete-session assertions; justified, not redundant noise.
- **Regression guard:** Diff adds coverage only; it does not revert leave/resume, Home card, or app-return prompt behavior from the listed orchestrator commits.
- **Quality gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all reported passing (55 tests).

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; 55 tests passed.
- Store coverage exists for `leaveWorkout` setting `pausedAt`, `resumeWorkoutEntry` clearing it, and the new `loadActiveSession` paused-session rehydration case.
- Route/prompt helpers are unit-tested for paused-only prompting, workout-route suppression, legacy incomplete-session exclusion, and cold-start foreground suppression.
- Static evidence supports the ACs: Leave Workout persists via `leaveWorkout()` and routes to `/(tabs)`; Home gates `PausedWorkoutResumeCard` on `hasPausedSession`; resume routes to `/workout/[splitId]`; root mounts `useResumeWorkoutPrompt()`.
- Conflict handling appears preserved: Home uses `isIncompleteActiveSession` for unfinished-workout alerts, so paused and legacy incomplete sessions still block starting a different split.
- Regression guard: the provided diff only adds paused rehydration test coverage and does not undo the recent paused-workout behavior.
- Manual/device-only checks such as visual prominence, actual tab browsing feel, iOS swipe-back, Android hardware back, and alert interaction polish are deferred to manual QA per orchestrator guidance.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets in diff**: The change is a single test case addition. No API keys, tokens, environment variables, or credentials are present.

- **AsyncStorage safety — adapter layer**: All AsyncStorage reads and writes go through `src/storage/adapters/sessions.ts`. Components and the store never touch AsyncStorage directly, matching the ticket's requirement. The existing swipe-hint flag is the sole documented exception and is not touched by this diff.

- **AsyncStorage read validation (pre-existing, not introduced by diff)**: `getActiveSession` does `JSON.parse(raw) as WorkoutSession` without a schema check — an unchecked cast. However, `loadActiveSession` defensively clamps `currentExerciseIndex` and wraps everything in a try/catch that routes errors to `set({ error: ..., isLoaded: true })`, so a malformed blob degrades gracefully rather than crashing. This pattern is consistent across the adapter (`getSessions` uses the same approach). Not introduced by this diff; no new exposure.

- **Data validation on `pausedAt`**: `hasPausedSession` checks `session.pausedAt != null` (loose null check, catching both `null` and `undefined`). `leaveWorkout` assigns `Date.now()` — always a positive integer. `loadActiveSession` passes the stored value straight through without coercing; a non-numeric `pausedAt` stored by a future schema change would silently propagate, but within the current codebase this is not reachable.

- **No unsafe patterns**: No `eval`, no dynamic `require`, no shell commands, no file paths from user/document picker anywhere in the touched or reviewed files.

- **User input sanitization**: `substituteExercise` calls `.trim()` before persisting a user-supplied exercise name. `splitName` and `splitId` are system-generated values (from the splits store), not user-free-form inputs used in navigation or storage keys.

- **Router push with `splitId`**: `router.push(\`/workout/${splitId}\`)` uses a value read from the locally stored session, not directly from user text input. No injection vector exists for a local-only mobile app.

- **Regression guard**: The new test verifies that `loadActiveSession` preserves `pausedAt` and `completedAt: null` — directly supporting the paused-session rehydration behavior introduced across commits `248820a` through `f57208e`. No existing test is removed or weakened.

- **Test isolation**: `beforeEach` calls `vi.clearAllMocks()` and fully resets store state; the new test uses only the established `makeSession` helper with typed overrides. No shared mutable state leaks between cases.
## Run 2026-06-29T04:17:51.294Z

Artifacts: `tickets/20260629-001334`

### Ticket
## Title

Pause workout to browse tabs, resume from Home, and prompt on app return

## Context

During an active workout, users need to step away from the session screen to browse Home, Splits, History, or Settings without losing logged sets. The workout stack blocks accidental exit (back/swipe) via a cancel sheet; **Leave Workout** is the deliberate pause path.

Foundational pieces already exist:

- `leaveWorkout()` in `workoutStore` sets `pausedAt` and persists to `sessions:active`
- `PausedWorkoutResumeCard` on Home when `hasPausedSession()` is true
- `useResumeWorkoutPrompt()` mounted in `app/_layout.tsx` for cold-start and foreground **Resume Workout?** alerts

This ticket ensures the full user journey is wired correctly end-to-end—explicit pause, free tab browsing, Home resume, and app-return prompt—with no false positives for in-progress (non-paused) sessions.

## Goal

Users can explicitly leave (pause) an in-progress workout, browse the tab menu freely, resume from a prominent Home button while paused, and see the familiar **Resume Workout?** alert when returning to the app after leaving.

## Non-goals

- Auto-pausing when the app backgrounds without the user choosing **Leave Workout**
- Resume CTA on tabs other than Home (Splits, History, Settings)
- Persisting or restoring rest-timer state across leave/resume
- Renaming **Leave Workout** to **Pause** in the cancel sheet (unless copy clarity requires it)
- Changing finish/discard flows or history persistence

## Requirements

1. **Leave workout (pause)**
   - The workout cancel/exit sheet must offer **Leave Workout** alongside discard and keep-going options.
   - **Leave Workout** must persist the in-progress session (sets, exercise index, split metadata) via the sessions adapter and set `pausedAt`.
   - After leaving, navigate to `/(tabs)` so the user can browse all tabs without remaining on the workout stack.
   - Accidental back/swipe exit must still be blocked unless the user confirms leave, discard, or finish.

2. **Home resume button**
   - When an active session has `pausedAt` set, Home must show a prominent resume card/button with the split name.
   - Tapping resume navigates to `/workout/[splitId]` and clears `pausedAt` on entry for the matching split via `resumeWorkoutEntry`.
   - The card must not appear for completed sessions or for in-progress sessions that were never explicitly left (no `pausedAt`).

3. **App return prompt**
   - On cold start and when returning from background, if there is a paused active session (`pausedAt` set, `completedAt` null) and the user is not on a workout route, show the existing **Resume Workout?** alert (Resume / Discard).
   - Rehydrate session from AsyncStorage via `loadActiveSession()` before evaluating prompt eligibility.
   - Suppress duplicate prompts on cold start + immediate foreground (debounce/guard).
   - Do not prompt while the user is on `/workout/[splitId]`.

4. **Conflict handling (must not regress)**
   - Starting a different split while a paused or incomplete session exists must still show the unfinished-workout conflict alert (Resume current / Discard).

## Acceptance criteria

- [ ] From an active workout, choosing **Leave Workout** saves progress to active session storage, sets `pausedAt`, and lands the user on the tab menu with free navigation across Home, Splits, History, and Settings.
- [ ] After leaving, Home displays `PausedWorkoutResumeCard` with the correct split name and a working **Resume** action.
- [ ] Tapping **Resume** on Home opens `/workout/[splitId]`, restores exercise index and logged sets, and clears `pausedAt` so the card disappears.
- [ ] After leaving a paused workout and backgrounding or force-quitting the app, reopening shows **Resume Workout?** with the correct split name; **Resume** navigates to the workout and **Discard** clears the active session.
- [ ] No resume prompt appears when the user is already on a workout route, or when there is no paused session (`pausedAt` unset).
- [ ] Swipe/back from the workout screen without confirming leave/discard does not exit the workout or set `pausedAt`.
- [ ] Starting a different split while a paused session exists still blocks with the unfinished-workout conflict flow.
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` all pass.

## Edge cases

- User leaves workout, resumes from Home, leaves again—session updates `pausedAt` each time without data loss.
- User leaves workout, taps **Resume** on Home, then continues—no duplicate prompts or stale Home card.
- Cold start triggers resume alert; immediate foreground event must not show a second alert (guard window via `shouldSuppressForegroundPrompt`).
- Legacy active sessions in storage without `pausedAt` do not show Home resume card or app-return prompt (explicit leave only); conflict alert still applies when starting another workout.
- Active session for split A paused; user attempts split B from Home or Splits—conflict alert, no silent overwrite.
- `loadActiveSession` not yet complete on Home—no flash of wrong UI; resume card appears once session is loaded.
- Android hardware back and iOS swipe-back both route through the same cancel sheet before leave.

## Implementation notes

**Response mode:** Standard ceremony.

**Files to verify, wire, or extend (avoid duplicate implementations):**

| Area | Files |
|------|--------|
| Leave / exit UX | `app/workout/[splitId].tsx` — cancel bottom sheet (**Leave Workout**, `handleLeaveWorkout`, `beforeRemove` / `BackHandler`, `isLeavingIntentionallyRef`) |
| Store & persistence | `src/features/workout/store/workoutStore.ts` — `leaveWorkout`, `resumeWorkoutEntry`, `loadActiveSession`; `src/storage/adapters/sessions.ts` — `getActiveSession` / `setActiveSession` |
| Route helpers | `src/features/workout/lib/workoutRoute.ts` — `hasPausedSession`, `shouldPromptResumeSession`, `shouldSuppressForegroundPrompt`, `isWorkoutRoute`, `isIncompleteActiveSession` |
| Home resume UI | `app/(tabs)/index.tsx` — `loadActiveSession`, `hasPausedSession`, `PausedWorkoutResumeCard`, `handleResumePausedWorkout`, `startWorkoutForSplit` conflict guard; `src/features/workout/components/PausedWorkoutResumeCard.tsx` |
| App-return prompt | `src/features/workout/hooks/useResumeWorkoutPrompt.ts`; mount in `app/_layout.tsx` |
| Types / exports | `src/features/workout/types.ts` (`pausedAt`, `currentExerciseIndex`), `src/features/workout/index.ts` |
| Tests | `src/features/workout/__tests__/workoutStore.test.ts`, `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` |

**Guidance:**

- Extend existing `leaveWorkout` / `pausedAt` flow; do not add new store fields unless required.
- Keep persistence through `sessions:active` adapter only—no raw AsyncStorage in components.
- Ensure Home calls `loadActiveSession()` on mount so the resume card survives app restart.
- Gate Home resume card and app-return prompt on `hasPausedSession` (requires `pausedAt`); use `isIncompleteActiveSession` separately for conflict alerts.
- Match existing typography/haptics patterns (`textRoles`, haptics consistent with adjacent cancel-sheet actions).

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

- Store tests: `leaveWorkout` sets `pausedAt` and persists; `resumeWorkoutEntry` clears `pausedAt` for matching `splitId`; `loadActiveSession` rehydrates paused session with clamped `currentExerciseIndex`.
- Route/prompt tests: `hasPausedSession` true only with `pausedAt`; `shouldPromptResumeSession` false on workout routes and for legacy incomplete-only sessions; `shouldSuppressForegroundPrompt` prevents duplicate cold-start + foreground alerts.

**Manual QA (UI flows):**

1. Start a workout, log at least one set, open cancel sheet → **Leave Workout** → confirm tabs are browsable (visit Splits and Settings).
2. Open Home → verify paused resume card appears with correct split → tap **Resume** → verify exercise index/sets restored and card gone after re-entering.
3. Leave workout again → background app → foreground → verify single **Resume Workout?** alert; test both Resume and Discard.
4. Leave workout → force-quit app → relaunch → verify cold-start prompt (once) with correct split name.
5. While paused, attempt to start a different split → verify conflict alert.
6. Swipe/back from workout without confirming → verify cancel sheet appears and session is not paused.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Ticket scope (pause surfaces):** Leave/resume wiring stays within the ticket’s file list — `leaveWorkout` / `resumeWorkoutEntry` / `loadActiveSession` in the store, route helpers in `workoutRoute.ts`, `PausedWorkoutResumeCard` + Home gating, `useResumeWorkoutPrompt` in `_layout.tsx`, and cancel-sheet / `beforeRemove` / `BackHandler` in `[splitId].tsx`. No extra store fields beyond `pausedAt` / `currentExerciseIndex`.
- **Branch scope creep (not blocking this ticket):** The branch also carries unrelated work (`FinishWorkoutSheet`, `LogSheet`, `WorkoutDatePicker`, `splits.tsx` CTA inset change, orchestrator/package churn). Pause additions in `[splitId].tsx` are targeted (Leave Workout row, intentional-leave ref, navigation guards); finish-sheet integration belongs to a sibling ticket.
- **Regression guard:** No undo of paused-workout behavior from the listed orchestrator commits. Home’s old “prompt any active session on mount” flow was correctly replaced by `hasPausedSession`-gated resume card + root `useResumeWorkoutPrompt` (explicit pause only).
- **Requirements alignment:** Leave Workout persists via `setActiveSession`, sets `pausedAt`, navigates to `/(tabs)`; back/swipe blocked until confirm; Home resume card gated on `hasPausedSession`; resume clears `pausedAt` via `resumeWorkoutEntry` on workout entry; app-return prompt rehydrates with `loadActiveSession`, suppresses duplicates via `shouldSuppressForegroundPrompt`, and skips workout routes; Home conflict guard uses `isIncompleteActiveSession` for a different split.
- **AGENTS.md patterns:** Zustand + sessions adapter persistence (no raw AsyncStorage in pause/resume flow); NativeWind + `textRoles` on `PausedWorkoutResumeCard`; feature exports through `src/features/workout/index.ts`; tests added for store and pure route helpers per project convention.
- **TypeScript:** No unjustified `any` in pause/resume code paths.
- **Minimal diff:** New pause pieces are small, focused modules (`workoutRoute.ts`, `PausedWorkoutResumeCard.tsx`, `useResumeWorkoutPrompt.ts`); store changes extend existing actions rather than rewriting the file.
- **Naming:** Matches surrounding workout feature conventions (`leaveWorkout`, `hasPausedSession`, `shouldPromptResumeSession`, etc.).
- **Quality gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all pass (55 tests, including pause/resume store and route coverage).
- **Minor note (non-blocking):** `[splitId].tsx` uses direct `expo-haptics` like adjacent cancel actions rather than `useHaptics()` — consistent with existing screen code, not a new inconsistency introduced for pause alone.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Verified `.squad/skills/testing/SKILL.md` Pass 2 expectations.
- Acceptance criteria have static evidence in the diff: `Leave Workout` persists `pausedAt`, routes to `/(tabs)`, Home gates `PausedWorkoutResumeCard` on `hasPausedSession`, and workout entry clears `pausedAt` via `resumeWorkoutEntry`.
- App-return prompt is mounted in `app/_layout.tsx`, reloads active session before prompting, suppresses cold-start/foreground duplicates, and skips workout routes.
- Conflict handling remains covered on Home and in the workout route for different split attempts while an incomplete session exists.
- New pure route helpers and store pause/resume behavior have unit coverage in workout tests.
- Automated gates are green per provided output: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0.
- Manual-only ACs deferred to manual QA: device swipe/back gesture behavior, visual prominence/tap target verification, and actual cross-tab browsing on device.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

**No secrets in diff**
- No API keys, tokens, `.env` values, or hardcoded credentials found in any of the feature files (`workoutStore.ts`, `workoutRoute.ts`, `useResumeWorkoutPrompt.ts`, `sessions.ts`, `PausedWorkoutResumeCard.tsx`, `app/(tabs)/index.tsx`, `app/_layout.tsx`). `devtools` middleware is gated on `process.env.APP_ENV === 'development'`.

**AsyncStorage data validated on read (backup/import paths)**
- `getActiveSession()` in `sessions.ts` uses `JSON.parse(raw) as WorkoutSession` — a bare type assertion with no runtime schema validation. If the stored JSON is structurally malformed (missing `exercises`, `splitId`, etc.), downstream code that uses non-null assertions (`s!.splitId`, `s!.splitName` in `useResumeWorkoutPrompt.ts`) could surface unexpected routing or runtime errors.
- Mitigating factors: `loadActiveSession()` in the store clamps `currentExerciseIndex` with `Math.max(0, Math.min(...))` and wraps in try/catch; `splitId` is generated by `generateId()` in-app (not directly user-typed); this is runtime session state, not a backup/import path per the SKILL.md qualifier — risk surface is limited to rooted/modified device scenarios.

**Raw AsyncStorage in a component**
- `app/workout/[splitId].tsx` imports `AsyncStorage` directly and reads/writes `STORAGE_KEYS.HAS_SEEN_SWIPE_HINT` (lines 13, 232–244). The ticket guidance says "Keep persistence through `sessions:active` adapter only — no raw AsyncStorage in components." However, this key is a pure UI preference unrelated to session data and appears to be pre-existing code not introduced by this feature; it does not affect session security.

**User input sanitized where persisted**
- `substituteExercise` calls `substituteName.trim()` and guards on empty string before persisting. Notes, reps, and weight inputs are typed primitives (`string`, `number`) passed through a typed interface — no raw string concatenation into storage keys or queries. No injection vector in local AsyncStorage context.

**Unsafe patterns (eval, dynamic require, shell)**
- None found. No `eval`, `Function()`, `require()` with dynamic strings, or child process calls in any reviewed file.

**File paths from user/document picker**
- No document picker or external file path handling in this feature.

**splitId used in router navigation**
- `router.push('/workout/${splitId}')` in both `useResumeWorkoutPrompt.ts` and `app/(tabs)/index.tsx` uses `splitId` sourced from AsyncStorage without format validation. In Expo Router (React Native), this resolves against defined routes — not a browser URL — so path-traversal has no meaningful attack surface. The value originates from `generateId()` in the same app, keeping the risk theoretical.

**Regression guard — no behaviour undone**
- `leaveWorkout` sets `pausedAt` and persists via `setActiveSession` ✓; `resumeWorkoutEntry` clears `pausedAt` ✓; `loadActiveSession` rehydrates with clamped index ✓; `hasPausedSession` requires `pausedAt != null` ✓; `shouldPromptResumeSession` suppresses on workout routes ✓; `shouldSuppressForegroundPrompt` debounce guard present ✓. None of the commits listed in the regression guard are undermined.

## Required fixes

None — verdict is PASS.
## Run 2026-06-29T04:44:28.952Z

Artifacts: `tickets/20260629-003930`

### Ticket
## Title

Pause workout to browse tabs, resume from Home, and prompt on app return

## Context

Users need to step out of an in-progress workout to use the rest of the app (Home, Splits, History, Settings) without losing logged sets or progress. Grynd already has partial building blocks:

- `leaveWorkout()` in `src/features/workout/store/workoutStore.ts` sets `pausedAt` and persists via `src/storage/adapters/sessions.ts`.
- Home resume UI in `app/(tabs)/index.tsx` and `src/features/workout/components/PausedWorkoutResumeCard.tsx` (gated by `hasPausedSession` in `src/features/workout/lib/workoutRoute.ts`).
- App-return Alert in `src/features/workout/hooks/useResumeWorkoutPrompt.ts`, mounted from `app/_layout.tsx`.
- Exit flow in `app/workout/[splitId].tsx` (cancel sheet: Discard / Leave / Keep Going).

This ticket completes and hardens the end-to-end pause → browse → resume flow so behavior is consistent, discoverable, and test-covered.

## Goal

When a user explicitly leaves a workout, they can browse the tab menu freely. While paused, Home shows a clear resume action. If they background or quit the app and return later, they see the familiar “Resume Workout?” prompt (unless already on the workout screen).

## Non-goals

- Auto-pausing on app background without the user choosing “Leave Workout”.
- Resume affordance on non-Home tabs (Splits, History, Settings).
- Treating force-quit / crash mid-workout (no `pausedAt`) as a paused session for Home card or app-return prompt.
- Changes to rest-timer pause/resume inside the workout screen (`useWorkout.ts`).
- Redesign of the cancel sheet or global navigation architecture.

## Requirements

1. **Leave = pause:** From an active workout, “Leave Workout” must set `pausedAt`, persist the session (including `currentExerciseIndex` and logged sets), reset in-workout UI state (e.g. rest timer), and navigate to `/(tabs)` so the user can switch tabs.
2. **Blocked silent exit:** Back gesture, header close, and hardware back must still open the cancel sheet—not leave the workout without an explicit Discard or Leave choice.
3. **Home resume when paused:** When `hasPausedSession(activeSession)` is true, Home must show a resume button:
   - If the paused split matches today’s cycle split: replace “Start Workout” in the Today card with “Resume {splitName}”.
   - Otherwise: show `PausedWorkoutResumeCard` above the Today card.
   - Tapping resume navigates to `/workout/{splitId}`; `resumeWorkoutEntry` clears `pausedAt` on workout screen entry (existing bootstrap behavior).
4. **App return prompt:** On cold start and when returning from background/inactive, if a paused session exists and the user is not on a `/workout/` route, show Alert: “Resume Workout?” with Discard and Resume. Suppress duplicate prompts per existing `shouldSuppressForegroundPrompt` guard.
5. **Conflict handling unchanged:** Starting a different split while an incomplete session exists continues to show “Unfinished Workout” (Discard / Resume)—no regression.
6. **Persistence:** Paused session survives app kill and rehydrates via `loadActiveSession()` on Home and in the resume prompt hook.

## Acceptance criteria

- [ ] During an active workout, tapping close/back opens the cancel sheet; “Leave Workout” lands on the tab navigator and the session remains in storage with `pausedAt` set and `completedAt` null.
- [ ] After leaving, the user can switch between Home, Splits, History, and Settings without being forced back into the workout screen.
- [ ] On Home, when a paused session exists and matches today’s split, the Today card shows “Resume {splitName}” instead of “Start Workout”.
- [ ] On Home, when a paused session exists and does not match today’s split (or today is a rest day), `PausedWorkoutResumeCard` is visible with a working resume button.
- [ ] Tapping any Home resume control opens the workout at the saved exercise index with all logged sets intact; `pausedAt` is cleared after re-entering the workout screen.
- [ ] After leaving a paused workout and backgrounding or force-quitting the app, reopening shows “Resume Workout?” with Discard (clears session) and Resume (navigates to workout)—unless the user is already on `/workout/...`.
- [ ] “Discard Workout” from the cancel sheet or resume prompt removes the active session from storage; Home resume UI and app-return prompt no longer appear.
- [ ] Starting a workout for a different split while a paused session exists still shows the unfinished-workout conflict alert (no silent overwrite).
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` all pass.

## Edge cases

- **Rest day + paused workout:** Paused card shows above Today; Today still shows rest-day content (no erroneous “Start Workout” for the paused split in Today).
- **Paused split equals today’s split on a rest day:** Resume via `PausedWorkoutResumeCard`, not Today card.
- **Re-enter same workout route after Leave:** Workout bootstrap calls `resumeWorkoutEntry`; session loads without duplicate start.
- **Another split’s unfinished session:** Existing “Unfinished Workout” alert on workout screen entry remains correct.
- **Rapid foreground/background:** Foreground prompt is debounced; no stacked alerts (`alertVisibleRef` guard).
- **Cold start + immediate foreground:** Second prompt suppressed within `COLD_START_GUARD_MS` (2s).
- **Legacy incomplete session (no `pausedAt`):** Does not show Home resume card or app-return prompt; conflict alert when starting another split still applies.

## Implementation notes

**Verify / harden existing flows (primary touch points):**

| Area | Files |
|------|-------|
| Pause + persist | `src/features/workout/store/workoutStore.ts` — confirm `leaveWorkout` writes `currentExerciseIndex`, `pausedAt`, and calls `setActiveSession` |
| Storage | `src/storage/adapters/sessions.ts` — no schema change expected; confirm round-trip preserves `pausedAt` |
| Leave UX + navigation | `app/workout/[splitId].tsx` — `handleLeaveWorkout`, `isLeavingIntentionallyRef`, `beforeRemove` / back handler; ensure all sheets dismiss and `router.replace('/(tabs)')` runs after `leaveWorkout()` |
| Route helpers | `src/features/workout/lib/workoutRoute.ts` — `hasPausedSession`, `shouldPromptResumeSession`, `isWorkoutRoute` |
| Home resume UI | `app/(tabs)/index.tsx` — `showPausedResume`, `pausedMatchesToday`, `showPausedCard`, `handleResumePausedWorkout`; call `loadActiveSession()` on mount |
| Resume card component | `src/features/workout/components/PausedWorkoutResumeCard.tsx` — reuse for non-today paused sessions; keep Today-card inline resume for matching split |
| App-return prompt | `src/features/workout/hooks/useResumeWorkoutPrompt.ts` — cold start + `AppState` listener; wire in `app/_layout.tsx` |
| Public exports | `src/features/workout/index.ts` — export helpers/components if Home needs them |

**Optional polish (only if missing in manual QA):**

- Add a one-line subtitle under “Leave Workout” in the cancel sheet (e.g. “Save progress and return to Home”) so pause intent is clear—copy-only change in `app/workout/[splitId].tsx`.

**Tests (required for store/route logic per `.squad/skills/testing/SKILL.md`):**

- Extend `src/features/workout/__tests__/workoutStore.test.ts` if any `leaveWorkout` / `resumeWorkoutEntry` behavior changes.
- Extend `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` for any new/changed `workoutRoute.ts` helpers.
- Do not add component snapshot tests; UI ACs are manual.

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual (UI flows):**

1. Start a workout, log at least one set, swipe to exercise 2+, open cancel sheet → **Leave Workout** → confirm landing on Home tabs.
2. Switch to Splits and Settings; confirm no forced navigation back to workout.
3. Return to Home → confirm resume button (Today card or `PausedWorkoutResumeCard` per cycle state) → tap Resume → confirm exercise index and sets restored; `pausedAt` cleared.
4. Leave workout again → background app (or force-quit) → reopen → confirm “Resume Workout?” alert; test both Resume and Discard paths.
5. With paused session, tap a different split on Home → confirm “Unfinished Workout” alert still works.
6. From workout, choose **Discard Workout** → confirm session cleared and no resume UI/prompt on Home or app reopen.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Ticket scope (pause surfaces):** Leave/resume work stays within the ticket’s touch points — `workoutStore.ts` (`leaveWorkout`, `resumeWorkoutEntry`, index persistence on `goToExercise` / `loadActiveSession`), `workoutRoute.ts` helpers, `PausedWorkoutResumeCard`, Home gating in `app/(tabs)/index.tsx`, `useResumeWorkoutPrompt` mounted from `app/_layout.tsx`, and cancel-sheet / `beforeRemove` / `BackHandler` wiring in `app/workout/[splitId].tsx`. No new store fields beyond `pausedAt` and `currentExerciseIndex`.
- **Branch-level scope creep (not blocking this ticket):** `feat/workout-enhancements` also carries finish-confirmation (`FinishWorkoutSheet`, `WorkoutDatePicker`), LogSheet anchoring, and orchestrator infra from separate commits on the same branch. Those files are outside this ticket’s implementation-notes table; they coexist on the branch but are not required for pause behavior.
- **Regression guard:** Checked against the listed pause/resume commits — no undo of leave-to-tabs, Home resume, or app-return prompt behavior. Home’s old “prompt any active session on mount” flow was correctly replaced by `hasPausedSession`-gated resume UI plus root `useResumeWorkoutPrompt` (explicit pause only; legacy incomplete sessions without `pausedAt` still use conflict handling via `isIncompleteActiveSession`).
- **Requirements alignment:** Leave Workout persists via `setActiveSession`, sets `pausedAt`, resets rest timer, and navigates to `/(tabs)`; back/close/hardware back opens cancel sheet; Home shows TODAY **Resume {splitName}** when paused split matches today’s split, otherwise `PausedWorkoutResumeCard` above Today (including rest-day edge cases via `pausedMatchesToday` requiring `todayDay?.type === 'split'`); resume clears `pausedAt` through `resumeWorkoutEntry` on workout entry; app-return prompt rehydrates with `loadActiveSession`, suppresses duplicates via `shouldSuppressForegroundPrompt` / `alertVisibleRef`, and skips `/workout/*` routes.
- **AGENTS.md patterns:** Zustand + storage adapters (no raw AsyncStorage for session state); NativeWind `className` + `textRoles`; barrel exports in `src/features/workout/index.ts`; unit tests for store transitions and pure route guards per AGENTS.md (“Do not skip tests for new pure functions or store logic”). Minor note: `[splitId].tsx` uses direct `expo-haptics` for discard/leave — pre-existing on that screen, not introduced by pause logic.
- **Minimal diff:** Pause-specific store/route/hook/card/Home changes are incremental. `[splitId].tsx` is larger due to co-branch finish-sheet work (commit `8f01bb5`), not due to pause logic alone; pause hunks (`handleLeaveWorkout`, `isLeavingIntentionallyRef`, bootstrap `resumeWorkoutEntry`) are localized.
- **Naming:** Matches surrounding conventions (`leaveWorkout`, `hasPausedSession`, `shouldPromptResumeSession`, `pausedMatchesToday`, `showPausedCard`).
- **TypeScript:** No unjustified `any` in pause-related code; non-null assertions in `useResumeWorkoutPrompt` follow `shouldPromptResumeSession` guards.
- **Quality gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all pass (55 tests), including `workoutStore.test.ts` leave/resume/index/clamp/rehydrate coverage and `useResumeWorkoutPrompt.test.ts` route/guard coverage.
- **Optional polish:** No subtitle under “Leave Workout” in the cancel sheet — ticket marks this optional; not a blocker.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Checked `.squad/skills/testing/SKILL.md`: CLI/manual guidance allows PASS with green automated gates plus static AC evidence.
- Pause flow evidence found: `leaveWorkout()` sets `pausedAt`, preserves `currentExerciseIndex` and logged session data, persists via `setActiveSession`; workout leave handler resets rest timer, dismisses sheets, and navigates to `/(tabs)`.
- Silent exits remain blocked: `beforeRemove` and hardware back present the cancel sheet unless an intentional leave/discard/finish is in progress.
- Home resume evidence found: paused matching-today sessions replace Start with `Resume {splitName}`; non-matching/rest-day paused sessions render `PausedWorkoutResumeCard`.
- Resume/persistence evidence found: Home/prompt navigate to `/workout/{splitId}`, workout bootstrap calls `resumeWorkoutEntry`, and tests verify `pausedAt` clears while saved index rehydrates.
- App-return prompt evidence found: root layout mounts `useResumeWorkoutPrompt`; hook handles cold start and foreground return, suppresses workout routes, debounces duplicate prompts, and Discard clears the session.
- Conflict handling evidence found: starting a different split with an incomplete active session still shows the existing “Unfinished Workout” alert.
- Test coverage present for new store and route/helper logic in `workoutStore.test.ts` and `useResumeWorkoutPrompt.test.ts`; no new untested pure utility concern found.
- Regression guard: current branch still preserves the behavior described by the recent pause/resume commits; no undo/regression found.
- Automated gates provided are green: `npm run typecheck`, `npm run lint`, and `npm run test` all passed, with 55 tests passing.
- Deferred to manual QA: actual device/UI interaction checks such as tab switching feel, cancel sheet tapping, visual resume card placement, and native background/foreground Alert display.

---

# Pass 3 (pass3_security)

## Verdict
PASS

## Findings

- **No secrets in diff**: No API keys, tokens, `.env` values, or hardcoded credentials anywhere in the touched files. `STORAGE_KEYS` are harmless namespaced strings. `devtools` is gated behind `process.env.APP_ENV === 'development'`. Clean.

- **AsyncStorage data validated on read**: `getActiveSession()` uses `JSON.parse(raw) as WorkoutSession` — a TypeScript cast with no runtime schema validation. However, the SKILL.md qualifier is "backup/import paths"; this is strictly internal app-written data (no user import path exists in this diff). The store additionally clamps `currentExerciseIndex` to valid bounds on read (lines 51–57 of `workoutStore.ts`). Pre-existing pattern, not introduced by this ticket.

- **User input sanitized where persisted**: `substituteExercise` trims `substituteName` before storing (line 148, `workoutStore.ts`). `notes` from `notesInput` is persisted as-is, but this is a local-only app with no HTML rendering surface — no injection risk. Acceptable.

- **No unsafe `eval`, dynamic requires, or shell commands**: None found across all touched files (`src/features/workout/**`, `src/storage/adapters/sessions.ts`, `app/workout/[splitId].tsx`, `app/(tabs)/index.tsx`, `app/_layout.tsx`).

- **`splitId` used in route construction**: `router.push(\`/workout/${splitId}\`)` in `useResumeWorkoutPrompt.ts` (line 46) and `app/(tabs)/index.tsx` (line 64) — `splitId` comes from AsyncStorage session data. `generateId()` produces only `[0-9a-z-]` characters (base-36 timestamp + random), so path traversal is not possible.

- **`splitName` interpolated into Alert message**: Template literal in `Alert.alert` (line 31, `useResumeWorkoutPrompt.ts`). React Native alerts render plain text, not HTML — no XSS surface.

- **Non-null assertions `s!.splitId` / `s!.splitName`** (lines 69, 96, `useResumeWorkoutPrompt.ts`): Both are guarded by `shouldPromptResumeSession(s, ...)`, which transitively checks `session !== null` via `isIncompleteActiveSession`. Assertions are logically safe.

- **File paths from user/document picker**: Not applicable — no file picker is used in this diff.

- **Regression guard**: `leaveWorkout` sets `pausedAt`, `resumeWorkoutEntry` strips it via destructuring (`const { pausedAt: _, ...rest }`), `hasPausedSession` / `shouldPromptResumeSession` gate all resume UI and prompts — all behaviors from the listed commits are preserved, no regressions detected.
