# Pause (leave) active workout to browse tabs, resume from Home, and return-to-workout on app reopen
## Run 2026-06-29T04:21:46.741Z

Artifacts: `tickets/20260629-001819`

### Ticket
## Title

Pause (leave) active workout to browse tabs, resume from Home, and return-to-workout on app reopen

## Context

During a workout, Grynd pushes `app/workout/[splitId].tsx` on the root stack. Users need to step out to browse the tab menu (Home, Splits, History, Settings) without discarding logged sets. When they explicitly leave (pause) a workout, Home should offer a clear **Resume** entry point. If they background or force-quit the app while that paused session is persisted, returning should show the familiar **“Resume Workout?”** alert.

In-progress sessions are already persisted via `STORAGE_KEYS.ACTIVE_SESSION` (`src/storage/adapters/sessions.ts`) and `useWorkoutStore`. Some building blocks may already exist (`leaveWorkout`, `PausedWorkoutResumeCard`, `useResumeWorkoutPrompt`, `pausedAt` on `WorkoutSession`); this ticket completes and verifies the end-to-end UX against the user request.

**Response mode:** Standard ceremony (multi-file feature: store, workout screen, Home, root hook).

## Goal

Let users **leave (pause)** an in-progress workout, browse the app freely, **resume from Home**, and get a **return-to-workout prompt** when reopening the app — without losing logged sets or exercise position.

## Non-goals

- Persisting rest-timer state across leave, background, or app kill (`useRestTimer` may reset on leave)
- Push/local notifications for paused workouts
- Multiple simultaneous paused workouts (one `ACTIVE_SESSION` remains the model)
- Global “paused” badge on every tab (Home resume CTA is sufficient)
- Renaming **Leave Workout** to **Pause** everywhere unless copy review requests it
- Treating force-quit mid-workout (without **Leave Workout**) as paused for Home/prompt UI — only sessions explicitly left via **Leave Workout** (`pausedAt` set) qualify

## Requirements

1. **Leave workout (pause)** — From the in-workout cancel sheet, add or verify **Leave Workout** (distinct from **Discard Workout**):
   - Persists the active session (logged sets + `currentExerciseIndex`) via `setActiveSession`
   - Sets `pausedAt` on the session to mark explicit pause
   - Resets in-memory rest timer state
   - Navigates to `/(tabs)` so the user can browse all tabs

2. **Resume from Home** — When `hasPausedSession(session)` is true after `loadActiveSession()` on Home:
   - Show a prominent **Resume {splitName}** control on Home
   - If the paused session’s `splitId` matches today’s cycle split, the TODAY card primary CTA must be **Resume {splitName}** (not **Start Workout**); avoid duplicate resume CTAs for the same split
   - If the paused session is for a different split (or today is rest / no cycle), show the dedicated **PAUSED WORKOUT** card above Today
   - Tapping Resume navigates to `/workout/{splitId}`; workout bootstrap calls `resumeWorkoutEntry(splitId)` to clear `pausedAt` and restore index/sets

3. **Resume on app return** — When the app cold-starts or returns from background with a paused session (`pausedAt` set) and the user is **not** on a `/workout/*` route, show `Alert` titled **“Resume Workout?”** with **Discard** (destructive) and **Resume** — same copy as existing prompt. Mount at root (`app/_layout.tsx`) so it fires from any non-workout route (tabs, `/cycle`, `/progress`, etc.).

4. **Conflict handling** — Starting or navigating to `/workout/{otherSplitId}` while a different incomplete session exists must show the existing unfinished-workout alert; **Resume** navigates to the stored split’s workout route.

5. **Discard still clears** — **Discard Workout** (sheet) and **Discard** (alert) call `abandonWorkout()`, clear storage, and remove Home resume UI and prompts.

6. **Copy & a11y** — Sheet label **Leave Workout**; resume controls include `accessibilityLabel` (e.g. `Resume paused workout`).

## Acceptance criteria

- [ ] Workout cancel sheet offers **Leave Workout**, **Discard Workout**, and **Keep Going**; **Leave Workout** navigates to tabs without clearing `ACTIVE_SESSION` or logged sets
- [ ] `leaveWorkout()` persists session + `currentExerciseIndex` + `pausedAt` and does **not** call `clearActiveSession`
- [ ] After leaving, user can switch among Home, Splits, History, and Settings without losing the paused session
- [ ] Home shows **Resume {splitName}** when a paused session exists — TODAY card swap when split matches today, otherwise **PAUSED WORKOUT** card above Today
- [ ] Tapping Home Resume opens `/workout/{splitId}` at the saved exercise index with logged sets intact; `pausedAt` is cleared on workout entry
- [ ] Cold start with a paused session (user not on `/workout/*`) shows **“Resume Workout?”** with Discard and Resume
- [ ] App background → foreground with a paused session (user not on `/workout/*`) shows the same resume alert
- [ ] No duplicate resume alerts from cold start + foreground within the debounce/guard window
- [ ] Resume alert is **not** shown while the user is on `/workout/*`
- [ ] Opening a different split while a paused session exists shows conflict alert; **Resume** routes to the stored split
- [ ] Discard from cancel sheet or resume alert clears active session and removes Home resume UI
- [ ] **Discard Workout** and **finish workout** regressions: session cleared; no resume affordances remain
- [ ] Unit tests cover `leaveWorkout`, `resumeWorkoutEntry`, index persistence, and prompt-route guards; `npm run typecheck`, `npm run lint`, and `npm run test` pass

## Edge cases

- Leave with zero sets logged: session still resumable; Discard still available
- Leave mid-rest-timer: rest timer resets; workout data remains intact
- Stale `currentExerciseIndex` after split edits while paused: `loadActiveSession` clamps to valid range
- User dismisses resume alert (`cancelable: true`): session stays paused; Home resume still available
- Rapid background/foreground transitions: debounce prevents stacked alerts
- Paused session references a deleted split: navigate gracefully with existing bootstrap error handling (no crash)
- User on workout screen when app foregrounds: no return prompt
- Finish workout while paused record exists: active session cleared; no resume UI or prompt

## Implementation notes

| Area | File(s) | Notes |
|---|---|---|
| Session shape | `src/features/workout/types.ts` | Ensure optional `currentExerciseIndex?: number` and `pausedAt?: number` on `WorkoutSession` |
| Store: leave / resume / index | `src/features/workout/store/workoutStore.ts` | Verify `leaveWorkout()` (sets `pausedAt`, persists index), `resumeWorkoutEntry(splitId)` (clears `pausedAt`), `loadActiveSession()` (restore + clamp index), `goToExercise` persists index |
| Route/pause helpers | `src/features/workout/lib/workoutRoute.ts` | `hasPausedSession`, `shouldPromptResumeSession`, `isWorkoutRoute` — extend tests if logic changes |
| Storage | `src/storage/adapters/sessions.ts` | Reuse `getActiveSession` / `setActiveSession` / `clearActiveSession`; no new keys |
| Leave UI + bootstrap | `app/workout/[splitId].tsx` | Cancel sheet **Leave Workout** → `resetRestTimer()`, `leaveWorkout()`, `router.replace('/(tabs)')`; on init for matching `splitId`, `resumeWorkoutEntry(splitId)`; conflict alert **Resume** → `router.replace(\`/workout/${storeSession.splitId}\`)` |
| Home resume CTAs | `app/(tabs)/index.tsx` | `loadActiveSession()` on mount; derive `showPausedResume` via `hasPausedSession`; swap TODAY **Start Workout** → **Resume {splitName}** when paused split matches today; render `PausedWorkoutResumeCard` when paused split ≠ today (or rest/no cycle) |
| Resume card UI | `src/features/workout/components/PausedWorkoutResumeCard.tsx` | Reuse or adjust styling; keep `accessibilityLabel` |
| App-return prompt | `src/features/workout/hooks/useResumeWorkoutPrompt.ts` | Cold-start + `AppState` foreground listener; guard with `shouldPromptResumeSession`; single-flight alert ref + cold-start guard |
| Hook mount | `app/_layout.tsx` | Mount `useResumeWorkoutPrompt()` at root (not tabs-only) |
| Barrel | `src/features/workout/index.ts` | Export hook, card, and route helpers used by screens |
| Tests | `src/features/workout/__tests__/workoutStore.test.ts`, `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` (or `workoutRoute.test.ts`) | Store transitions + pure prompt guards per `.squad/skills/testing/SKILL.md` |

Follow existing patterns: Zustand + storage adapters (no raw AsyncStorage in components), NativeWind `className`, `textRoles`, `useHaptics` on destructive actions.

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

Extend `src/features/workout/__tests__/workoutStore.test.ts` for leave/resume/index transitions and route-helper tests for paused-session gating.

**Manual QA:**

1. Start a workout, log sets on exercise 2+, open cancel sheet → **Leave Workout** → land on tabs; browse Splits, History, Settings without losing session.
2. Open Home → confirm **Resume {splitName}** (TODAY swap when split matches today, otherwise **PAUSED WORKOUT** card) → Resume restores exercise index and sets.
3. Leave workout → background app → foreground on a non-workout screen → **Resume Workout?** appears; Resume navigates correctly; Discard clears session and Home UI.
4. Force-quit with paused session → relaunch → cold-start alert + Home resume CTA still present.
5. With paused session for split A, start split B → conflict alert; **Resume** opens split A.
6. From paused state, open `/cycle` or `/progress`, background/foreground → resume alert still appears.
7. Finish workout → confirm no resume UI or alert remains.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — Only `app/(tabs)/index.tsx` changed. The diff targets ticket requirement #2 (TODAY card swap vs. dedicated PAUSED WORKOUT card) and does not touch store, workout screen, prompt hook, or unrelated files.
- **Ticket alignment** — Adds `pausedMatchesToday` and `showPausedCard` so when a paused session matches today’s split, the TODAY primary CTA becomes **Resume {splitName}** and `PausedWorkoutResumeCard` is hidden; otherwise the card stays above Today. Matches the acceptance criteria to avoid duplicate resume CTAs.
- **Regression guard** — Does not undo leave/persist (`leaveWorkout`), resume routing (`handleResumePausedWorkout` → `/workout/{splitId}`), conflict handling (`startWorkoutForSplit` + `isIncompleteActiveSession`), or app-return prompt (unchanged). It refines Home resume presentation; resume from Home remains available in both branches.
- **Minimal diff** — ~25 lines of localized conditional logic; no file rewrite, no new dependencies, no unrelated refactors.
- **AGENTS.md patterns** — Screen stays in `app/`; state comes from `useWorkoutStore` + `hasPausedSession`; styling uses NativeWind `className` and `textRoles`; resume control includes `accessibilityLabel="Resume paused workout"`, consistent with `PausedWorkoutResumeCard`.
- **Naming & conventions** — `pausedMatchesToday`, `showPausedCard`, and `handleResumePausedWorkout` match existing Home/workout naming. Reuses existing helpers rather than new store/route surface.
- **TypeScript** — No `any`; derived booleans are type-safe. Redundant `activeSession != null` checks are harmless, not blocking.
- **Duplication** — TODAY Resume button mirrors `PausedWorkoutResumeCard` markup; acceptable for a screen-local conditional and consistent with the minimal-diff rule (no premature abstraction).
- **Tests & gates** — `npm run typecheck`, `npm run lint`, and `npm run test` all pass (55 tests). No new pure helpers were added, so missing unit tests for this UI branching is reasonable per project conventions.
- **Edge cases covered by logic** — Rest day / no cycle / different split → `showPausedCard`; today split match → TODAY Resume only; same-split All Splits tap still routes via `startWorkoutForSplit` without conflict.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Checked `.squad/skills/testing/SKILL.md`; this CLI review can pass with green automated gates plus static AC evidence, with manual device checks deferred.
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; 55 Vitest tests passed.
- Store evidence exists for `leaveWorkout`, `resumeWorkoutEntry`, index persistence, `pausedAt`, discard, finish clearing, and stale index clamping in `src/features/workout/store/workoutStore.ts`.
- UI/static evidence exists for cancel sheet copy/actions, rest timer reset on leave/discard, Home resume CTA/card behavior, no duplicate same-split resume CTA, conflict alert routing, root-mounted resume prompt, route guards, and accessibility labels.
- Tests cover store transitions and prompt-route helpers in `src/features/workout/__tests__/workoutStore.test.ts` and `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts`.
- No regression found against the listed recent commits; the current diff narrows Home paused-card rendering and preserves the paused-workout flow.
- Deferred to manual QA: actual device tab browsing, visual prominence, tap behavior, background/foreground OS behavior, force-quit relaunch behavior, and rest-timer visual reset.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **Secrets / credentials**: No API keys, tokens, or credentials appear in any reviewed file. `STORAGE_KEYS` contains only string literals for local device storage namespaces — no sensitive data.

- **AsyncStorage safety (new code)**: The diff touches only `app/(tabs)/index.tsx`. No raw AsyncStorage calls are introduced there. All session reads/writes continue to flow exclusively through the adapter layer (`src/storage/adapters/sessions.ts`), which wraps every `getItem`/`setItem`/`removeItem` in try/catch and re-throws on write failures with descriptive messages.

- **AsyncStorage safety (pre-existing, not introduced by diff)**: `app/workout/[splitId].tsx` imports and calls `AsyncStorage` directly for the swipe-hint flag (lines 232–239). This violates the "no raw AsyncStorage in components" pattern from the ticket implementation notes, but it pre-dates this diff and is out of scope for a regression guard.

- **Data validation on deserialized session**: `getActiveSession()` casts the parsed JSON with `as WorkoutSession` rather than a runtime schema check. A corrupted or hand-crafted payload could bypass type expectations. This is a pre-existing pattern consistent throughout the codebase and not changed by the diff. Index clamping (`Math.max(0, Math.min(...))`) in `loadActiveSession` provides a meaningful runtime guard for the most exploitable field.

- **`splitId` / `splitName` in navigation and alerts**: Values interpolated into `router.push('/workout/${...}')` and `Alert.alert(...)` originate from the app-generated stored session, not from any external or user-typed string. React Native's navigation and Alert APIs are not susceptible to DOM-style injection.

- **Non-null assertions (`s!`)** in `useResumeWorkoutPrompt.ts` (lines 69, 96): Both assertions are downstream of `shouldPromptResumeSession → hasPausedSession → isIncompleteActiveSession`, which narrows `session` to non-null before the assertion is reached. Safe.

- **`void abandonWorkout()`** in the prompt hook's Discard handler silently swallows rejection. Pre-existing pattern; no change introduced here.

- **`pausedAt` type coherence**: Typed as `number | undefined` on `WorkoutSession`; checked with `!= null` (covers both `undefined` and `null`); removed via destructuring in `resumeWorkoutEntry`. Consistent and correct.

- **Single-flight alert guard + cold-start debounce**: `alertVisibleRef` and `coldStartPromptAtRef` with a 2 000 ms window correctly prevent stacked alerts on rapid background/foreground transitions.

- **No regressions against listed commits**: The diff preserves `leaveWorkout` (sets `pausedAt`, does not clear session), `resumeWorkoutEntry` (clears `pausedAt`), the Home resume affordances, and the root-level `useResumeWorkoutPrompt` mount. All commit-described behaviours remain intact.
## Run 2026-06-29T04:35:56.973Z

Artifacts: `tickets/20260629-002216`

### Ticket
## Title

Pause (leave) active workout to browse tabs, resume from Home, and return-to-workout on app reopen

## Context

During a workout, Grynd pushes `app/workout/[splitId].tsx` on the root stack and blocks accidental exit (back/swipe) via a cancel sheet. Users need a deliberate way to **leave (pause)** the session, browse the tab menu (Home, Splits, History, Settings), and return later without losing logged sets or exercise position.

In-progress sessions are persisted via `STORAGE_KEYS.ACTIVE_SESSION` in `src/storage/adapters/sessions.ts` and `useWorkoutStore`. Building blocks may already exist (`leaveWorkout`, `pausedAt` on `WorkoutSession`, `PausedWorkoutResumeCard`, `useResumeWorkoutPrompt`); this ticket completes and verifies the end-to-end UX against the user request.

**Response mode:** Standard ceremony (multi-file feature: store, workout screen, Home, root hook).

## Goal

Let users **leave (pause)** an in-progress workout, browse the app freely, **resume from Home**, and see the familiar **“Resume Workout?”** prompt when reopening the app after background or force-quit — without losing logged sets or exercise position.

## Non-goals

- Persisting rest-timer state across leave, background, or app kill (`useRestTimer` may reset on leave)
- Push/local notifications for paused workouts
- Multiple simultaneous paused workouts (one `ACTIVE_SESSION` remains the model)
- Global “paused” badge on every tab (Home resume CTA is sufficient per request)
- Renaming **Leave Workout** to **Pause** everywhere unless copy review requests it
- Treating force-quit mid-workout (without **Leave Workout**) as paused for Home/prompt UI — only sessions explicitly left via **Leave Workout** (`pausedAt` set) qualify

## Requirements

1. **Leave workout (pause)** — From the in-workout cancel sheet, offer **Leave Workout** (distinct from **Discard Workout**):
   - Persists the active session (logged sets + `currentExerciseIndex`) via `setActiveSession`
   - Sets `pausedAt` on the session to mark explicit pause
   - Resets in-memory rest timer state
   - Navigates to `/(tabs)` so the user can browse all tabs

2. **Resume from Home** — When `hasPausedSession(session)` is true after `loadActiveSession()` on Home:
   - Show a prominent **Resume {splitName}** control
   - If the paused session’s `splitId` matches today’s cycle split, the TODAY card primary CTA must be **Resume {splitName}** (not **Start Workout**); avoid duplicate resume CTAs for the same split
   - If the paused session is for a different split (or today is rest / no cycle), show the dedicated **PAUSED WORKOUT** card above Today
   - Tapping Resume navigates to `/workout/{splitId}`; workout bootstrap calls `resumeWorkoutEntry(splitId)` to clear `pausedAt` and restore index/sets

3. **Resume on app return** — When the app cold-starts or returns from background with a paused session (`pausedAt` set) and the user is **not** on a `/workout/*` route, show `Alert` titled **“Resume Workout?”** with **Discard** (destructive) and **Resume** — same copy as the existing prompt. Mount at root (`app/_layout.tsx`) so it fires from any non-workout route (tabs, `/cycle`, `/progress`, etc.).

4. **Conflict handling** — Starting or navigating to `/workout/{otherSplitId}` while a different incomplete session exists must show the existing unfinished-workout alert; **Resume** navigates to the stored split’s workout route.

5. **Discard still clears** — **Discard Workout** (sheet) and **Discard** (alert) call `abandonWorkout()`, clear storage, and remove Home resume UI and prompts.

6. **Copy & a11y** — Sheet label **Leave Workout**; resume controls include `accessibilityLabel` (e.g. `Resume paused workout`).

## Acceptance criteria

- [ ] Workout cancel sheet offers **Leave Workout**, **Discard Workout**, and **Keep Going**; **Leave Workout** navigates to tabs without clearing `ACTIVE_SESSION` or logged sets
- [ ] `leaveWorkout()` persists session + `currentExerciseIndex` + `pausedAt` and does **not** call `clearActiveSession`
- [ ] After leaving, user can switch among Home, Splits, History, and Settings without losing the paused session
- [ ] Home shows **Resume {splitName}** when a paused session exists — TODAY card swap when split matches today, otherwise **PAUSED WORKOUT** card above Today
- [ ] Tapping Home Resume opens `/workout/{splitId}` at the saved exercise index with logged sets intact; `pausedAt` is cleared on workout entry
- [ ] Cold start with a paused session (user not on `/workout/*`) shows **“Resume Workout?”** with Discard and Resume
- [ ] App background → foreground with a paused session (user not on `/workout/*`) shows the same resume alert
- [ ] No duplicate resume alerts from cold start + foreground within the debounce/guard window
- [ ] Resume alert is **not** shown while the user is on `/workout/*`
- [ ] Opening a different split while a paused session exists shows conflict alert; **Resume** routes to the stored split
- [ ] Discard from cancel sheet or resume alert clears active session and removes Home resume UI
- [ ] **Discard Workout** and **finish workout** regressions: session cleared; no resume affordances remain
- [ ] Unit tests cover `leaveWorkout`, `resumeWorkoutEntry`, index persistence, and prompt-route guards; `npm run typecheck`, `npm run lint`, and `npm run test` pass

## Edge cases

- Leave with zero sets logged: session still resumable; Discard still available
- Leave mid-rest-timer: rest timer resets; workout data remains intact
- Stale `currentExerciseIndex` after split edits while paused: `loadActiveSession` clamps to valid range
- User dismisses resume alert (`cancelable: true`): session stays paused; Home resume still available
- Rapid background/foreground transitions: debounce prevents stacked alerts
- Paused session references a deleted split: navigate gracefully with existing bootstrap error handling (no crash)
- User on workout screen when app foregrounds: no return prompt
- Finish workout while paused record exists: active session cleared; no resume UI or prompt

## Implementation notes

| Area | File(s) | Notes |
|---|---|---|
| Session shape | `src/features/workout/types.ts` | Ensure optional `currentExerciseIndex?: number` and `pausedAt?: number` on `WorkoutSession` |
| Store: leave / resume / index | `src/features/workout/store/workoutStore.ts` | Verify `leaveWorkout()` (sets `pausedAt`, persists index), `resumeWorkoutEntry(splitId)` (clears `pausedAt`), `loadActiveSession()` (restore + clamp index), `goToExercise` persists index |
| Route/pause helpers | `src/features/workout/lib/workoutRoute.ts` | `hasPausedSession`, `shouldPromptResumeSession`, `isWorkoutRoute`, `shouldSuppressForegroundPrompt` — extend tests if logic changes |
| Storage | `src/storage/adapters/sessions.ts` | Reuse `getActiveSession` / `setActiveSession` / `clearActiveSession`; no new keys |
| Leave UI + bootstrap | `app/workout/[splitId].tsx` | Cancel sheet **Leave Workout** → dismiss open sheets, `resetRestTimer()`, `leaveWorkout()`, `router.replace('/(tabs)')`; on init for matching `splitId`, `resumeWorkoutEntry(splitId)`; conflict alert **Resume** → `router.replace(\`/workout/${storeSession.splitId}\`)`; keep `beforeRemove` / `BackHandler` + `isLeavingIntentionallyRef` |
| Home resume CTAs | `app/(tabs)/index.tsx` | `loadActiveSession()` on mount; derive `showPausedResume` via `hasPausedSession`; swap TODAY **Start Workout** → **Resume {splitName}** when paused split matches today; render `PausedWorkoutResumeCard` when paused split ≠ today (or rest/no cycle) |
| Resume card UI | `src/features/workout/components/PausedWorkoutResumeCard.tsx` | Reuse or adjust styling; keep `accessibilityLabel` |
| App-return prompt | `src/features/workout/hooks/useResumeWorkoutPrompt.ts` | Cold-start + `AppState` foreground listener; guard with `shouldPromptResumeSession`; single-flight alert ref + cold-start guard |
| Hook mount | `app/_layout.tsx` | Mount `useResumeWorkoutPrompt()` at root (not tabs-only) |
| Barrel | `src/features/workout/index.ts` | Export hook, card, and route helpers used by screens |
| Tests | `src/features/workout/__tests__/workoutStore.test.ts`, `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` | Store transitions + pure prompt guards per `.squad/skills/testing/SKILL.md` |

Follow existing patterns: Zustand + storage adapters (no raw AsyncStorage in components), NativeWind `className`, `textRoles`, `useHaptics` on destructive actions.

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

Extend `src/features/workout/__tests__/workoutStore.test.ts` for leave/resume/index transitions and `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` (or a dedicated `workoutRoute.test.ts`) for paused-session gating and foreground-prompt suppression.

**Manual QA:**

1. Start a workout, log sets on exercise 2+, open cancel sheet → **Leave Workout** → land on tabs; browse Splits, History, Settings without losing session.
2. Open Home → confirm **Resume {splitName}** (TODAY swap when split matches today, otherwise **PAUSED WORKOUT** card) → Resume restores exercise index and sets.
3. Leave workout → background app → foreground on a non-workout screen → **Resume Workout?** appears; Resume navigates correctly; Discard clears session and Home UI.
4. Force-quit with paused session → relaunch → cold-start alert + Home resume CTA still present.
5. With paused session for split A, start split B → conflict alert; **Resume** opens split A.
6. From paused state, open `/cycle` or `/progress`, background/foreground → resume alert still appears.
7. Finish workout → confirm no resume UI or alert remains.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Ticket scope (pause surfaces):** Leave/resume wiring stays within the ticket’s file list — store (`leaveWorkout`, `resumeWorkoutEntry`, index persistence), `workoutRoute.ts` helpers, `PausedWorkoutResumeCard` + Home gating, `useResumeWorkoutPrompt` in `_layout.tsx`, and cancel-sheet / `beforeRemove` / `BackHandler` in `[splitId].tsx`. No extra store fields beyond `pausedAt` / `currentExerciseIndex`.
- **Branch-level scope creep (not blocking this ticket):** `feat/workout-enhancements` also carries finish-confirmation (`FinishWorkoutSheet`, `WorkoutDatePicker`), LogSheet anchoring, splits CTA positioning, and orchestrator infra. Those are separate tickets/commits coexisting on the branch, not introduced by the latest pause iteration.
- **Regression guard:** No undo of paused-workout behavior from the listed orchestrator commits. Home’s old “prompt any active session on mount” flow was correctly replaced by `hasPausedSession`-gated resume card + root `useResumeWorkoutPrompt` (explicit pause only).
- **Requirements alignment:** Leave Workout persists via `setActiveSession`, sets `pausedAt`, navigates to `/(tabs)`; back/swipe blocked until confirm; Home resume card gated on `hasPausedSession`; resume clears `pausedAt` via `resumeWorkoutEntry` on workout entry; app-return prompt rehydrates with `loadActiveSession`, suppresses duplicates via `shouldSuppressForegroundPrompt`, and skips workout routes; Home conflict guard uses `isIncompleteActiveSession` for a different split.
- **AGENTS.md patterns:** Zustand + storage adapters (no raw AsyncStorage for session state); NativeWind `className` + `textRoles`; barrel exports in `src/features/workout/index.ts`; unit tests for store transitions and pure route guards. Minor note: `[splitId].tsx` uses direct `expo-haptics` for discard/leave rather than `useHaptics()` — pre-existing in that screen, not introduced by pause logic.
- **Minimal diff:** Pause-specific store/route/hook/card changes are incremental additions. `[splitId].tsx` is larger due to co-branch finish-sheet work (commit `8f01bb5`), not due to pause logic alone.
- **Naming:** Matches surrounding workout feature conventions (`leaveWorkout`, `hasPausedSession`, `shouldPromptResumeSession`, etc.).
- **TypeScript:** No unjustified `any`; non-null assertions in `useResumeWorkoutPrompt` are downstream of `shouldPromptResumeSession` narrowing.
- **Quality gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all pass (55 tests). Store tests cover leave/resume/index/clamp/discard/finish; route tests cover paused gating, workout-route suppression, and cold-start debounce.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gate is green: `npm run typecheck`, `npm run lint`, and `npm run test` all passed; Vitest reported 55 passing tests.
- Store ACs have evidence: `leaveWorkout()` persists `currentExerciseIndex` and `pausedAt` via `setActiveSession` without clearing; `resumeWorkoutEntry()` clears `pausedAt`; `abandonWorkout()` and `finishWorkout()` clear active session.
- Workout UI evidence is present: cancel sheet includes `Leave Workout`, `Discard Workout`, and `Keep Going`; Leave resets rest timer, persists pause, and routes to `/(tabs)`.
- Home resume evidence is present: paused sessions drive the Today CTA swap or dedicated `PAUSED WORKOUT` card, with `accessibilityLabel="Resume paused workout"` and no duplicate card when today matches.
- Root app-return prompt evidence is present: mounted in `app/_layout.tsx`, guards workout routes, supports cold start and foreground, and debounces cold-start/foreground duplicate alerts.
- Conflict handling evidence is present: navigating to a different workout with an incomplete active session shows the unfinished-workout alert and Resume routes to the stored split.
- Tests cover the required store transitions and pure prompt-route guards, including leave/resume/index persistence, paused-session gating, workout-route suppression, and cold-start guard timing.
- Regression guard checked against the listed recent pause/resume commits; current behavior preserves the described leave-to-tabs, Home resume, app-return prompt, conflict, and discard/finish clearing flows.
- Manual device QA is deferred for actual tab switching/tap behavior, background/foreground behavior, and force-quit relaunch prompt behavior; static evidence is reasonable and automated gates are green.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets in code**: No API keys, tokens, `.env` values, or credentials in any of the files introduced or modified by this feature.

- **AsyncStorage access pattern**: All pause/resume paths go through the storage adapter layer (`src/storage/adapters/sessions.ts` — `getActiveSession` / `setActiveSession` / `clearActiveSession`). No new raw `AsyncStorage` calls were introduced by this ticket's changes. One pre-existing raw `AsyncStorage` call exists in `app/workout/[splitId].tsx` (lines 232–244, swipe-hint flag); it is not part of this diff and poses no meaningful risk (a boolean preference flag, no user-controlled content).

- **AsyncStorage read validation**: `getActiveSession()` uses `JSON.parse(raw) as WorkoutSession` without structural validation. However: (a) the SKILL.md check targets "backup/import paths" specifically; (b) this is a self-contained local-only store — data is only ever written by the app's own store actions; (c) `loadActiveSession` already clamps `currentExerciseIndex` to a safe range, which is the field most likely to cause an out-of-bounds issue. No net-new validation gap was introduced.

- **User input sanitized**: The one free-text field that reaches persistence is exercise substitution via `substituteExercise` — it calls `.trim()` and bails on empty string before writing. `splitName` displayed in the resume alert and card originates from stored split records, not from a free-form user input at the time of display.

- **Route construction from stored data**: `router.push(\`/workout/${splitId}\`)` and `router.replace(\`/workout/${storeSession.splitId}\`)` use IDs that were written by the app itself (via `startWorkout`/`leaveWorkout`). Expo Router's file-based routing makes path injection a non-issue here (an unexpected segment resolves to a 404, not an exploit surface).

- **No `eval`, dynamic `require`, or shell execution**: None present anywhere in the touched files.

- **No file-picker paths**: Feature does not involve document/file picker; SKILL.md item is not applicable.

- **Regression guard**: `leaveWorkout` sets `pausedAt` and persists index without calling `clearActiveSession` ✓. `resumeWorkoutEntry` clears `pausedAt` ✓. `abandonWorkout` calls `clearActiveSession` ✓. `finishWorkout` calls `clearActiveSession` ✓. No introduced behaviour contradicts the guarded commits.
## Run 2026-06-29T04:38:55.009Z

Artifacts: `tickets/20260629-003624`

### Ticket
## Title

Pause (leave) active workout to browse tabs, resume from Home, and return-to-workout on app reopen

## Context

Workouts run on a full-screen stack route (`app/workout/[splitId].tsx`) above the tab navigator. Today, backing out of an in-progress workout surfaces a cancel sheet with **Discard** and **Keep Going**, but there is no way to intentionally pause and keep progress while browsing Splits, History, Cycle, etc.

Users need a **Leave Workout** path that preserves the in-progress session (exercise index, logged sets) so they can return later from Home or after reopening the app—without treating every backgrounded session as “unfinished.”

Existing building blocks on `feat/workout-enhancements`:

- `WorkoutSession.pausedAt` in `src/features/workout/types.ts`
- Store actions `leaveWorkout` / `resumeWorkoutEntry` in `src/features/workout/store/workoutStore.ts`
- Cancel sheet “Leave Workout” in `app/workout/[splitId].tsx`
- Home resume UI in `app/(tabs)/index.tsx` + `PausedWorkoutResumeCard`
- App-return prompt via `useResumeWorkoutPrompt` in `app/_layout.tsx`

This ticket scopes the end-to-end behavior and any remaining wiring/polish so all three user flows work consistently.

## Goal

Allow users to **explicitly pause (leave)** an active workout, browse the app freely, **resume from Home** when a paused session exists, and see the familiar **“Resume Workout?”** alert when returning to the app with a paused session still on disk.

## Non-goals

- Auto-pausing when the app is backgrounded without the user choosing **Leave Workout**
- Resume entry points on non-Home tabs (History, Splits, etc.)
- Persisting or restoring the rest timer across leave/resume (timer may reset on leave)
- Changing discard/finish workout flows or history export behavior
- Multi-session support (only one active/paused session at a time)

## Requirements

1. **Leave = pause**
   - From the in-workout cancel sheet, **Leave Workout** must:
     - Persist the current session to active-session storage with `pausedAt` set
     - Preserve `currentExerciseIndex` and all logged sets
     - Navigate to the tab root (`/(tabs)`) so the user can browse tabs
   - **Discard Workout** must still clear the session entirely (unchanged)
   - Hardware back / navigation back while in an active workout must continue to show the cancel sheet (not silently exit)

2. **Resume from Home**
   - When `hasPausedSession(activeSession)` is true and Home loads/rehydrates the session:
     - If the paused split matches **today’s cycle split**, replace the Today card **Start Workout** CTA with **Resume {splitName}**
     - Otherwise, show a prominent **Paused Workout** card above Today with **Resume {splitName}**
   - Tapping resume navigates to `/workout/{splitId}`; entering that screen clears `pausedAt` via `resumeWorkoutEntry`

3. **Return-to-workout on app reopen**
   - Root layout hook (`useResumeWorkoutPrompt`) must:
     - On cold start and on foreground (background → active), reload the active session
     - If session has `pausedAt` and user is **not** already on a workout route, show Alert: **“Resume Workout?”** with **Discard** / **Resume**
     - Suppress duplicate prompts when cold-start and foreground fire within the guard window
     - Not prompt for legacy incomplete sessions missing `pausedAt`, or for completed sessions

4. **Conflict handling (unchanged but must still work with paused sessions)**
   - Starting a different split while a paused session exists must show the existing **Unfinished Workout** alert (Resume / Discard)
   - Opening the paused split’s workout route must resume in place without starting a new session

## Acceptance criteria

- [ ] In an active workout, cancel sheet offers **Leave Workout**; choosing it saves session with `pausedAt`, keeps logged data, and lands on tab Home
- [ ] **Leave Workout** does not mark the session completed and does not write to workout history
- [ ] **Discard Workout** still clears the active session and does not leave a paused session behind
- [ ] With a paused session, Home shows **Resume {splitName}**—in the Today card when it matches today’s split, otherwise in the **Paused Workout** card
- [ ] Tapping Home resume opens the correct workout and restores exercise index / logged sets; `pausedAt` is cleared on entry
- [ ] With a paused session, killing/reopening the app (or backgrounding and returning) shows **Resume Workout?** when not on a workout screen
- [ ] Return prompt **Resume** navigates to the paused workout; **Discard** clears the session
- [ ] No return prompt while already on `/workout/[splitId]`
- [ ] Attempting to start another split while paused shows **Unfinished Workout** with Resume / Discard
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` all pass

## Edge cases

- **Rest day + paused workout:** Paused card appears above Today; Today still shows rest-day actions
- **Paused split ≠ today’s split:** Top **Paused Workout** card shown; Today **Start Workout** remains for today’s split (with conflict alert if tapped)
- **Legacy incomplete session without `pausedAt`:** No Home paused UI and no app-return prompt; opening the matching workout route still resumes via `resumeWorkoutEntry`
- **User dismisses return alert without choosing:** Session stays paused; Home resume remains available
- **Double prompt on cold start + immediate foreground:** Guard window prevents duplicate alerts
- **Leave while sheets open (log, finish, substitute):** Sheets dismissed before leave; session state consistent
- **Empty or missing split on resume route:** Existing bootstrap error/empty states; no crash

## Implementation notes

**Store & types**

- `src/features/workout/types.ts` — ensure `pausedAt?: number` on `WorkoutSession`
- `src/features/workout/store/workoutStore.ts`
  - `leaveWorkout`: set `pausedAt: Date.now()`, persist via `setActiveSession`
  - `resumeWorkoutEntry(splitId)`: strip `pausedAt` for matching incomplete session, persist
  - `loadActiveSession`: rehydrate paused sessions including `currentExerciseIndex`

**Route helpers**

- `src/features/workout/lib/workoutRoute.ts`
  - `hasPausedSession`, `shouldPromptResumeSession`, `isWorkoutRoute`, `shouldSuppressForegroundPrompt`
- Export helpers from `src/features/workout/index.ts`

**Workout screen (leave / resume entry)**

- `app/workout/[splitId].tsx`
  - Cancel sheet: **Leave Workout** → `leaveWorkout()` + `router.replace('/(tabs)')`
  - Set `isLeavingIntentionallyRef` so `beforeRemove` / back handler don’t re-block
  - Bootstrap: if stored session matches `splitId`, call `resumeWorkoutEntry` instead of `startWorkout`
  - Reset rest timer on leave/discard

**Home resume UI**

- `src/features/workout/components/PausedWorkoutResumeCard.tsx` — card for paused split that isn’t today’s
- `app/(tabs)/index.tsx`
  - `loadActiveSession` on mount
  - Branch Today CTA vs `PausedWorkoutResumeCard` using `hasPausedSession` + cycle match
  - `handleResumePausedWorkout` → `router.push(\`/workout/${activeSession.splitId}\`)`
  - Keep existing conflict alert in `startWorkoutForSplit` using `isIncompleteActiveSession`

**App-return prompt**

- `src/features/workout/hooks/useResumeWorkoutPrompt.ts` — cold-start + `AppState` foreground listener
- `app/_layout.tsx` — call `useResumeWorkoutPrompt()` at root

**Persistence**

- `src/storage/adapters/sessions.ts` — no schema change expected; `pausedAt` round-trips on active session read/write

**Tests (required for store + pure helpers)**

- `src/features/workout/__tests__/workoutStore.test.ts` — `leaveWorkout`, `resumeWorkoutEntry`, rehydrate paused session
- `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` — route/prompt predicate coverage

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual (UI flows):**

1. Start a workout, log a set, open cancel sheet → **Leave Workout** → confirm Home loads and tabs are navigable (Splits, History, etc.)
2. On Home, confirm **Resume** appears (Today card or Paused Workout card) → tap → workout restores exercise index and logged sets
3. Leave again → background app or force-quit → reopen → confirm **Resume Workout?** alert; test both Resume and Discard paths
4. With paused session, tap a different split on Home → confirm **Unfinished Workout** alert
5. From active workout, confirm back gesture / Android back opens cancel sheet and **Discard** still works
6. Rest day in cycle with a paused non-today split → confirm Paused Workout card above rest-day Today card

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope:** The diff is limited to `src/features/workout/index.ts` (+2 export lines). It matches the ticket’s “Export helpers from `src/features/workout/index.ts`” note and does not touch unrelated files or behavior.
- **Minimal diff:** Two named re-exports only — no rewrites, no new dependencies, no logic changes.
- **Patterns / AGENTS.md:** Follows the existing feature barrel pattern (`hasPausedSession`, `isIncompleteActiveSession`, `shouldPromptResumeSession` were already exported from `./lib/workoutRoute`). Helpers remain pure functions in `lib/`; hook/tests correctly import from `workoutRoute` internally.
- **Ticket alignment:** Completes the public surface for `isWorkoutRoute` and `shouldSuppressForegroundPrompt`, which back app-return prompt behavior (workout-route suppression + cold-start/foreground dedupe). No change to leave/resume/store/persistence flows.
- **Regression guard:** Compared against the listed pause/resume commits — this adds exports only; it does not undo leave, Home resume, conflict handling, or return-to-workout prompt behavior.
- **TypeScript / quality gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all reported exit code 0 (55 tests passed, including `useResumeWorkoutPrompt.test.ts` and `workoutStore.test.ts`).
- **Naming:** Consistent with surrounding exports and `workoutRoute.ts` identifiers.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Verified `.squad/skills/testing/SKILL.md` criteria for Pass 2.
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited `0`; 55 tests passed.
- Store AC evidence exists for `leaveWorkout`, `resumeWorkoutEntry`, active-session rehydration, preserved exercise index, discard, and finish/history separation in `src/features/workout/store/workoutStore.ts`.
- Pure route helpers are present/exported and covered by unit tests, including paused detection, workout-route suppression, legacy incomplete sessions, completed sessions, and foreground prompt guard.
- UI/static evidence covers Leave Workout, Home resume placement, paused card, conflict alert, route resume, and root app-return prompt wiring.
- Regression guard checked against the listed recent commits; the current diff only exports route helpers and does not undo pause/resume/prompt behavior.
- Manual-only ACs such as device visual behavior, force-quit/reopen alert observation, tap targets, and native back gesture validation are deferred to manual QA per orchestrator instructions.

---

# Pass 3 (pass3_security)

## Verdict
PASS

## Findings

- **No secrets in diff** — The diff is two lines adding `isWorkoutRoute` and `shouldSuppressForegroundPrompt` to the barrel export. No `.env` values, API keys, or tokens appear anywhere in the touched files.

- **AsyncStorage reads validated at the boundary that matters** — `getActiveSession` does a bare `JSON.parse(raw) as WorkoutSession` cast with no runtime schema check. However, the SKILL.md concern targets backup/import paths (user-supplied data). Here the active-session key is exclusively written by the app via `setActiveSession`, so the surface is app-controlled local storage, not untrusted input. `loadActiveSession` additionally clamps `currentExerciseIndex` to `[0, exercises.length − 1]` before using it, preventing an out-of-bounds index from a corrupted record from being acted on.

- **User input sanitized before persistence** — `substituteExercise` calls `substituteName.trim()` and early-returns on empty string before writing to storage. `notes` in `logSet` is stored as raw JSON (no eval, no HTML rendering surface), which is acceptable.

- **`splitId` in router navigation** — `router.push(\`/workout/${splitId}\`)` in `useResumeWorkoutPrompt` uses a `splitId` sourced from AsyncStorage. `splitId` values are UUID strings generated by `generateId()` and never come from user-typed input, so URL injection is not a realistic concern in a React Native/Expo Router context.

- **`splitName` in Alert message** — Displayed in a native `Alert.alert` call, not in a WebView or HTML-rendered surface. No XSS vector.

- **No `eval`, dynamic `require`, or shell execution** — None found across all touched files.

- **devtools middleware correctly gated** — `devtools` is enabled only when `process.env.APP_ENV === 'development'`, preventing store state exposure in production.

- **Duplicate-prompt guard** — `alertVisibleRef` and `coldStartPromptAtRef` together prevent both concurrent duplicates and the cold-start + immediate-foreground double-fire race. Logic is straightforward and correctly resets on dismiss/action.

- **Regression check** — The diff only adds two previously-implemented helpers (`isWorkoutRoute`, `shouldSuppressForegroundPrompt`) to the public barrel. All three user flows (leave → browse → resume from Home; return-to-workout prompt; conflict handling) remain intact. No regression against the listed commits detected.
