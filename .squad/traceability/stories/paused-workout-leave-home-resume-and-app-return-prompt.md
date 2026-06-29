# Paused workout leave, Home resume, and app-return prompt
## Run 2026-06-29T03:57:14.840Z

Artifacts: `tickets/20260628-235255`

### Ticket
## Title

Paused workout leave, Home resume, and app-return prompt

## Context

During an active workout, users need to step out to browse splits, history, settings, or other app areas without losing in-progress session data (logged sets, current exercise index). Today the workout screen blocks accidental exit via a cancel sheet, but there is no cohesive end-to-end story for **intentionally pausing**, **resuming from Home**, and **returning after leaving the app**.

Partial scaffolding exists on `feat/workout-enhancements`:

- `leaveWorkout()` / `resumeWorkoutEntry()` in `src/features/workout/store/workoutStore.ts` (persists `pausedAt`, `currentExerciseIndex` via `src/storage/adapters/sessions.ts`)
- Leave / Discard / Keep Going sheet in `app/workout/[splitId].tsx`
- `PausedWorkoutResumeCard` wired on Home in `app/(tabs)/index.tsx`
- Global resume alert via `useResumeWorkoutPrompt()` in `app/_layout.tsx` and `src/features/workout/hooks/useResumeWorkoutPrompt.ts`

This ticket completes, verifies, and hardens that flow so all three user paths behave consistently.

## Goal

Allow users to **leave (pause)** an in-progress workout, freely browse the app, **resume from Home**, and see the familiar **“Resume Workout?”** alert when returning to the app after a paused session was left.

## Non-goals

- In-screen rest-timer pause/resume behavior (between-set timer only; not persisted across leave)
- Paused-workout resume entry points on non-Home tabs (Splits, History, Settings)
- Auto-pausing a workout when the app backgrounds without the user choosing “Leave Workout”
- Workout history export/backup changes
- UI redesign of the cancel sheet or resume card beyond copy/visibility fixes needed for clarity

## Requirements

1. **Leave (pause) from workout**
   - From the workout cancel sheet, “Leave Workout” must persist the active session to AsyncStorage (`sessions:active`), set `pausedAt`, persist `currentExerciseIndex`, and navigate to the main tab navigator (`/(tabs)`) so the user can browse freely.
   - “Discard Workout” must still clear the active session entirely.
   - Hardware back / swipe-back while in an active workout must continue to show the cancel sheet (not silently abandon).

2. **Home resume CTA**
   - When an incomplete active session exists in the workout store (explicit leave via `pausedAt`, or legacy incomplete session in storage), Home (`app/(tabs)/index.tsx`) must show a prominent resume control (`PausedWorkoutResumeCard`) above the Today card.
   - Tapping resume navigates to `/workout/{splitId}` and restores the session at the saved exercise index.
   - Home must wait for session hydration (`loadActiveSession`) before rendering resume UI to avoid flash of incorrect state.

3. **App return prompt**
   - On cold start and when the app returns to foreground, if a paused/incomplete session exists and the user is **not** already on a workout route, show the existing native alert: **“Resume Workout?”** with **Discard** and **Resume**.
   - Suppress duplicate prompts within the existing cold-start guard window (`COLD_START_GUARD_MS` in `src/features/workout/lib/workoutRoute.ts`).
   - Do not show the alert while the user is on `/workout/*`.

4. **Resume entry restores state**
   - Re-entering the matching workout route must call `resumeWorkoutEntry(splitId)` to clear `pausedAt` while keeping logged sets and exercise index.
   - Attempting to start a **different** split while a paused session exists must continue to show the “Unfinished Workout” conflict alert (Discard / Resume other).

5. **Home UX when paused**
   - When a paused session is visible on Home, avoid presenting a conflicting “Start Workout” path without guardrails: either disable Today’s start CTA when it would conflict with the paused split, or route through the existing unfinished-workout conflict flow—no silent overwrite of the paused session.

## Acceptance criteria

- [ ] From an in-progress workout, choosing **Leave Workout** saves the session (including logged sets and current exercise index), sets `pausedAt`, and lands the user on the tab navigator where they can switch tabs and open stack screens (e.g. Cycle, Progress).
- [ ] Choosing **Discard Workout** clears `sessions:active` and removes any Home resume CTA.
- [ ] With a paused/incomplete session, Home shows `PausedWorkoutResumeCard` with the correct split name and a working **Resume** button.
- [ ] Tapping **Resume** on Home opens `/workout/{splitId}` at the saved exercise with all previously logged sets intact; `pausedAt` is cleared on entry.
- [ ] After leaving a paused workout and backgrounding/killing the app, returning to the app (cold start or foreground) shows **“Resume Workout?”** when not on a workout route.
- [ ] **Resume** on the app-return alert navigates to the paused workout; **Discard** clears the session and dismisses follow-up prompts/cards.
- [ ] No duplicate resume alert is shown within `COLD_START_GUARD_MS` of the cold-start prompt.
- [ ] Starting a different split while a paused session exists surfaces the unfinished-workout conflict UI; no data loss without explicit Discard.
- [ ] Unit tests cover any new/changed store or route-helper logic; existing tests in `workoutStore.test.ts` and `useResumeWorkoutPrompt.test.ts` remain green.

## Edge cases

- **Legacy sessions** without `pausedAt` but with `completedAt === null` still qualify for Home resume card and app-return prompt (migrate gracefully on resume entry).
- **User dismisses** the resume alert (cancelable): session remains paused; Home card still available.
- **Rapid foreground/background** toggles: debounced prompt (`FOREGROUND_DEBOUNCE_MS`) must not stack multiple alerts (`alertVisibleRef` guard).
- **Session index out of range** after split edits: clamp index on `loadActiveSession` (existing behavior) and resume safely.
- **Leave while sheets open** (log, overview, substitute, finish): all sheets dismissed before persist/navigation.
- **Concurrent navigation**: intentional leave sets `isLeavingIntentionallyRef` so `beforeRemove` does not re-open the cancel sheet.

## Implementation notes

**Store & persistence**

- `src/features/workout/store/workoutStore.ts` — verify `leaveWorkout`, `resumeWorkoutEntry`, `loadActiveSession` (index clamping), `abandonWorkout`.
- `src/storage/adapters/sessions.ts` — `getActiveSession` / `setActiveSession` / `clearActiveSession`; no new storage keys.
- `src/features/workout/types.ts` — `pausedAt?`, `currentExerciseIndex?` on `WorkoutSession`.

**Route helpers**

- `src/features/workout/lib/workoutRoute.ts` — `hasPausedSession`, `shouldPromptResumeSession`, `shouldSuppressForegroundPrompt`, `isWorkoutRoute`.

**Screens & hooks**

- `app/workout/[splitId].tsx` — `handleLeaveWorkout`, cancel sheet copy/actions, bootstrap `init()` conflict + resume paths, back interception.
- `app/(tabs)/index.tsx` — session hydration gate, `PausedWorkoutResumeCard` visibility, resume handler, Today start CTA guard when paused.
- `app/_layout.tsx` — ensure `useResumeWorkoutPrompt()` remains mounted at root.
- `src/features/workout/hooks/useResumeWorkoutPrompt.ts` — cold-start + `AppState` foreground prompt.
- `src/features/workout/components/PausedWorkoutResumeCard.tsx` — Home resume UI (adjust copy/layout only if needed).
- `src/features/workout/index.ts` — export surface for shared hook/components/helpers.

**Tests**

- `src/features/workout/__tests__/workoutStore.test.ts` — leave/resume/index persistence.
- `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` — prompt eligibility and suppression.
- Add/adjust tests if Home conflict guard or `hasPausedSession` semantics change.

Prefer minimal diffs; reuse existing components and store actions rather than introducing new global state.

## Test plan

**Automated (required)**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual (UI)**

1. Start a workout, log at least one set, advance to exercise 2+, open cancel sheet → **Leave Workout** → confirm landing on tabs; switch Splits / History / Settings freely.
2. Open Home → confirm **Paused Workout** card with correct split name → **Resume** → confirm exercise index and logged sets restored.
3. Repeat leave flow → background app (or force-quit) → reopen → confirm **Resume Workout?** alert → test both **Resume** and **Discard**.
4. With a paused workout, attempt **Start Workout** for a different split from Home or Splits → confirm conflict alert; verify paused data survives until Discard.
5. While on `/workout/{splitId}`, background/foreground → confirm no resume alert on the workout screen itself.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — Diff is limited to three ticket-relevant files: Home conflict guard (`app/(tabs)/index.tsx`), legacy resume sync (`workoutStore.ts`), and matching store tests. No unrelated files, dependencies, or storage keys.

- **Ticket requirement #5 (Home conflict guard)** — `startWorkoutForSplit` intercepts Today “Start Workout” and All Splits taps when `hasPausedSession(activeSession)` and the target split differs, showing the existing “Unfinished Workout” Discard / Resume alert via `abandonWorkout()`. Same-split taps still route to `/workout/{splitId}` (resume, not overwrite). Matches the ticket’s “route through conflict flow” option.

- **Ticket edge case (legacy sessions)** — `resumeWorkoutEntry` guard changed from `pausedAt === undefined` → `completedAt !== null`, so incomplete sessions without `pausedAt` sync `currentExerciseIndex` and clear `pausedAt` on matching entry. Test updated from “no-ops when not paused” to explicit legacy-sync + completed-session no-op cases.

- **Regression guard** — Prior pause/leave/resume behavior is preserved: `leaveWorkout` still sets `pausedAt`; Home resume card, hydration gate, and app-return prompt are untouched. The store change extends (does not revert) prior `resumeWorkoutEntry` behavior for legacy incomplete sessions, which the ticket explicitly requires.

- **AGENTS.md patterns** — Zustand store actions used for persistence (`abandonWorkout`); no raw AsyncStorage in components; NativeWind/className styling unchanged; inline `Alert.alert` mirrors the existing pattern in `app/workout/[splitId].tsx`.

- **Minimal diff** — ~30 lines of focused Home logic, one guard-line change in the store, two targeted test adjustments. No full-file rewrites or new abstractions.

- **Naming & consistency** — `startWorkoutForSplit`, alert copy, and button labels match the workout screen conflict UI. `hasPausedSession` reused for eligibility.

- **TypeScript** — No `any` or type escapes in the diff.

- **Quality gates** — `npm run typecheck`, `npm run lint`, and `npm run test` all pass (54/54).

- **Minor nits (non-blocking)** — Home conflict Resume uses `router.push` while the workout bootstrap conflict uses `router.replace`; acceptable given different navigation contexts. Alert logic is duplicated between Home and workout screen rather than extracted; acceptable for minimal diff per ticket guidance.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; 54 tests passed.
- Store AC evidence is present: `leaveWorkout` persists `pausedAt` and `currentExerciseIndex`; `abandonWorkout` clears active storage; `resumeWorkoutEntry` clears `pausedAt` for paused and legacy incomplete sessions while preserving index/logged data.
- Home AC evidence is present: Home waits for `loadActiveSession`, shows `PausedWorkoutResumeCard` for incomplete sessions, resumes to `/workout/{splitId}`, and now guards different-split starts with the unfinished-workout alert.
- App-return prompt AC evidence is present: root mounts `useResumeWorkoutPrompt`, prompt eligibility includes legacy incomplete sessions, workout routes are suppressed, and cold-start foreground duplicate suppression is tested.
- Regression guard passed: the diff preserves the recent pause/leave, Home resume, and app-return prompt behavior and adds missing guard coverage without undoing those flows.
- Manual/device-only checks are deferred to manual QA: visual alert/card behavior, hardware back/swipe-back feel, tab browsing on device, and background/foreground UI presentation.
- Test coverage is adequate for changed store and route-helper logic; no new pure utility lacks tests.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets in diff** — no `.env` values, API keys, tokens, or hardcoded credentials anywhere in the changed files.

- **AsyncStorage read validation** — `getActiveSession()` uses `JSON.parse(raw) as WorkoutSession` (a cast, not runtime schema validation). This is a pre-existing pattern unchanged by this diff; the PR does not introduce a new unvalidated read path. `loadActiveSession` defensively clamps `currentExerciseIndex` via `Math.max/Math.min` before trusting the stored value.

- **`resumeWorkoutEntry` guard change** — replacing `session.pausedAt === undefined` with `session.completedAt !== null` is safe. `completedAt` is typed `number | null`; even if corrupted storage produced `undefined`, `undefined !== null` evaluates to `true`, correctly treating the session as resumable — intentional per the legacy-session edge case in the ticket.

- **User-supplied text in `Alert.alert`** — `activeSession.splitName` is interpolated into a native `Alert.alert` message string. React Native alerts render via platform-native dialogs (not a WebView), so there is no XSS or injection vector. The value originates from the user creating a split name, passed through the Zustand store and AsyncStorage without mutation.

- **`router.push` with dynamic segments** — both `targetSplitId` and `activeSession.splitId` are internal opaque IDs produced by `generateId()`, not free-text user input. No path-traversal risk.

- **`void abandonWorkout().then(...)` pattern** — `void` is used intentionally to suppress the floating promise in an event handler. The `.then()` chaining after `abandonWorkout()` is safe; errors from the store action propagate silently but `abandonWorkout` already wraps `clearActiveSession` which throws a typed error only on storage failure — consistent with existing error handling elsewhere.

- **No `eval`, dynamic `require`, or shell execution** — none present in the diff or surrounding code.

- **No file paths from document/image pickers** — not applicable to this diff.

- **Regression check against listed commits** — the diff extends `resumeWorkoutEntry` to handle legacy sessions (no `pausedAt`) and routes Home's "Start Workout" CTA through a conflict guard. No behaviour described in commits `2a5a4f9`–`8f01bb5` (leave/resume/prompt flow) is removed or undone.

## Required fixes

None.
## Run 2026-06-29T04:52:14.600Z

Artifacts: `tickets/20260629-004842`

### Ticket
## Title

Paused workout leave, home resume, and app-return prompt

## Context

During an active workout, users need to leave the session temporarily to browse the app (Splits, History, Cycle, etc.) without losing logged sets or progress. Today, backing out of the workout screen risks discarding progress or offers only “Discard.”

The workout feature already has Zustand session state persisted via `src/storage/adapters/sessions.ts`, a cancel sheet on `app/workout/[splitId].tsx`, and partial pause/resume primitives (`leaveWorkout`, `resumeWorkoutEntry`, `pausedAt` on `WorkoutSession`). This ticket wires those pieces into a cohesive pause/resume UX: explicit leave-to-pause, a home-screen resume entry point, and the existing-style “Resume Workout?” alert when returning to the app with a paused session.

**Response mode:** Standard ceremony (multi-file feature, full ticket + gates + 3-pass review).

## Goal

Allow users to **Leave Workout** (pause) and freely browse the tab menu, then resume from Home or via an app-return prompt—without losing in-progress session data.

## Non-goals

- Adding resume CTAs on non-Home tabs (Splits, History, etc.).
- Auto-pausing when the app is backgrounded without the user choosing “Leave Workout.”
- Persisting or restoring rest-timer countdown across pause/resume.
- Changing finish-workout or history-save behavior.
- Prompting to resume legacy incomplete sessions that lack `pausedAt` (only explicitly paused sessions qualify).

## Requirements

1. **Pause on leave**
   - “Leave Workout” in the cancel sheet must call store `leaveWorkout`, which sets `pausedAt`, persists `currentExerciseIndex`, and keeps the session in active storage (not `clearActiveSession`).
   - After leave, navigate to `/(tabs)` so the user can browse all tab routes.
   - Reset the rest timer on leave; do not block tab navigation after pause.

2. **Guard accidental exit while active (non-paused)**
   - While a workout is active and **not** paused, hardware back and stack `beforeRemove` must open the cancel sheet (Discard / Leave Workout / Keep Going)—not silently navigate away or auto-pause.

3. **Resume from Home**
   - When `hasPausedSession(activeSession)` is true, Home must show a resume affordance:
     - If the paused split matches **today’s cycle split**: replace the Today card “Start Workout” button with “Resume {splitName}.”
     - Otherwise (different split or rest day): show `PausedWorkoutResumeCard` above the Today card with “Resume {splitName}.”
   - Tapping resume navigates to `/workout/{splitId}`.

4. **Resume on workout entry**
   - Opening the workout screen for a paused session must call `resumeWorkoutEntry(splitId)`: clear `pausedAt`, restore/clamp `currentExerciseIndex`, persist, and continue the session without starting a new one.

5. **App-return prompt**
   - Mount `useResumeWorkoutPrompt` at app root (`app/_layout.tsx`).
   - On cold start and on foreground (app was backgrounded), if a paused session exists and the user is **not** on a `/workout/*` route, show the familiar `Alert.alert('Resume Workout?', ...)` with **Discard** (calls `abandonWorkout`) and **Resume** (navigates to workout).
   - Suppress duplicate foreground prompts within the cold-start guard window (`shouldSuppressForegroundPrompt`).

6. **Conflict handling**
   - Starting a different split while a paused (or other incomplete) session exists must continue to show the existing “Unfinished Workout” alert (Discard / Resume)—do not start a second active session.

## Acceptance criteria

- [ ] During an active workout, Cancel → “Leave Workout” sets `pausedAt` on the session, persists it via `setActiveSession`, and navigates to the Home tab without clearing logged sets.
- [ ] After leaving, the user can switch among all tab routes (Home, Splits, History, etc.) without being forced back into the workout screen.
- [ ] With a paused session, Home shows “Resume {splitName}” in the Today card when the paused split matches today’s scheduled split.
- [ ] With a paused session that does **not** match today (including on a rest day), Home shows `PausedWorkoutResumeCard` with a working Resume button.
- [ ] Tapping Resume on Home opens `/workout/{splitId}`, clears `pausedAt`, and restores the user to the saved exercise index.
- [ ] While a workout is active and not paused, Android back and stack back gesture open the cancel sheet instead of leaving without user choice.
- [ ] After leaving a paused workout and backgrounding the app, returning to the app shows the “Resume Workout?” alert (Discard / Resume) when not already on a workout route.
- [ ] On cold app launch with a persisted paused session, the same resume alert appears once (no duplicate prompt on immediate foreground re-entry within the guard window).
- [ ] “Discard” on the app-return alert clears the active session; “Resume” navigates to the correct workout screen.
- [ ] Attempting to start a different split while a paused session exists shows the unfinished-workout conflict alert instead of creating a second session.

## Edge cases

- Paused session references a split that was deleted: workout screen should show existing error/empty bootstrap messaging; Home resume may still navigate—acceptable, no crash.
- `currentExerciseIndex` out of range after exercise list changes: clamp on resume (existing store logic).
- User dismisses the resume alert without choosing an action: session remains paused; Home resume remains available.
- User is already on `/workout/{splitId}` when app foregrounds: no resume alert.
- Completing or discarding a workout clears paused state and removes Home resume UI and future prompts.
- Rapid tab switching or double-tap Resume does not create duplicate sessions or duplicate alerts (`alertVisibleRef` guard).

## Implementation notes

**Store & types**

- `src/features/workout/types.ts` — ensure `pausedAt?: number` and `currentExerciseIndex?: number` on `WorkoutSession`.
- `src/features/workout/store/workoutStore.ts` — implement/verify `leaveWorkout` (set `pausedAt`, persist index) and `resumeWorkoutEntry` (clear `pausedAt`, clamp index, persist). Rehydrate paused sessions in `loadActiveSession`.

**Route helpers**

- `src/features/workout/lib/workoutRoute.ts` — `hasPausedSession`, `shouldPromptResumeSession`, `isWorkoutRoute`, `shouldSuppressForegroundPrompt`.

**Hooks**

- `src/features/workout/hooks/useResumeWorkoutPrompt.ts` — cold-start + `AppState` foreground listener, Alert UI, debounce/guard.
- Export from `src/features/workout/index.ts`.

**UI**

- `app/workout/[splitId].tsx` — wire “Leave Workout” to `leaveWorkout` + `router.replace('/(tabs)')`; `beforeRemove` / `BackHandler` guards when not paused; bootstrap path calls `resumeWorkoutEntry` for matching paused session.
- `app/(tabs)/index.tsx` — load active session on mount; conditional Today-card Resume vs Start; render `PausedWorkoutResumeCard` when paused split ≠ today.
- `src/features/workout/components/PausedWorkoutResumeCard.tsx` — reusable card (create if missing).

**App root**

- `app/_layout.tsx` — call `useResumeWorkoutPrompt()`.

**Tests** (required for store + pure helpers per testing skill)

- `src/features/workout/__tests__/workoutStore.test.ts` — `leaveWorkout`, `resumeWorkoutEntry`, `loadActiveSession` paused rehydration.
- `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` — route/prompt helper unit tests (`hasPausedSession`, `shouldPromptResumeSession`, guard logic).

No changes to `.env`, storage keys, or new dependencies unless strictly necessary.

## Test plan

**Automated**

```bash
npm run typecheck
npm run lint
npm run test
```

Focus test coverage on `workoutStore` pause/resume transitions and `workoutRoute` prompt predicates.

**Manual (UI)**

1. Start a workout, log at least one set, open Cancel → Leave Workout → confirm landing on Home with session still in storage.
2. Browse Splits and History tabs; confirm no forced return to workout.
3. On Home, tap Resume; confirm return to correct exercise and `pausedAt` cleared.
4. Repeat leave; background the app; foreground → confirm “Resume Workout?” alert; test both Resume and Discard paths.
5. Force-quit app with paused session; relaunch → confirm single resume alert on cold start.
6. With paused session for today’s split, confirm Today card shows Resume (not Start).
7. With paused session for a non-today split (or on rest day), confirm `PausedWorkoutResumeCard` appears.
8. During active (non-paused) workout, press Android back / attempt stack back → cancel sheet appears, no silent exit.
9. Try starting a different split with paused session active → unfinished-workout conflict alert.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Ticket scope (pause/resume slice):** All implementation-note files are present and wired: `leaveWorkout` / `resumeWorkoutEntry` in the store, `workoutRoute` helpers, `useResumeWorkoutPrompt`, `PausedWorkoutResumeCard`, Home resume UI, workout-screen leave/guards/bootstrap, and root hook mount in `app/_layout.tsx`.
- **Requirement 1 — Pause on leave:** `handleLeaveWorkout` calls `leaveWorkout()`, resets the rest timer, sets `isLeavingIntentionallyRef`, and `router.replace('/(tabs)')`. Store sets `pausedAt`, persists `currentExerciseIndex`, and does not call `clearActiveSession`.
- **Requirement 2 — Guard accidental exit:** `beforeRemove` and `BackHandler` are active only when `bootstrapState === 'ready'`, session exists, and `session.pausedAt == null`. Cancel sheet offers Discard / Leave Workout / Keep Going.
- **Requirement 3 — Resume from Home:** Home uses `hasPausedSession` for resume UI only. Today card swaps to “Resume {splitName}” when paused split matches today; otherwise `PausedWorkoutResumeCard` renders above Today.
- **Requirement 4 — Resume on workout entry:** Bootstrap calls `resumeWorkoutEntry(splitId)` for a matching incomplete session; store clears `pausedAt`, clamps index, and persists.
- **Requirement 5 — App-return prompt:** `useResumeWorkoutPrompt` is mounted at app root. Cold-start and foreground paths use `shouldPromptResumeSession`, `alertVisibleRef`, and `shouldSuppressForegroundPrompt` (2s guard). Alert offers Discard (`abandonWorkout`) and Resume (navigate to workout).
- **Requirement 6 — Conflict handling:** Home `startWorkoutForSplit` and workout bootstrap both show “Unfinished Workout” for mismatched incomplete sessions via `isIncompleteActiveSession`.
- **Non-goals respected:** Prompts and Home resume UI require `pausedAt` (`hasPausedSession`). Legacy incomplete sessions without `pausedAt` are not prompted on app return (Home’s old blanket crash-recovery alert was correctly removed).
- **Regression guard:** No regression against listed orchestrator commits — leave-to-browse, Home resume, and app-return prompt behavior are preserved and tightened to paused-only prompting.
- **AGENTS.md patterns:** Zustand store + storage adapter persistence; NativeWind `className`; feature exports from `src/features/workout/index.ts`; required store/helper tests present.
- **TypeScript / naming:** No `any` escapes in ticket files; naming matches existing workout feature conventions.
- **Minimal diff (ticket slice):** Pause/resume additions are targeted (~35-line route module, ~108-line hook, ~31-line card, focused store methods). No full-file rewrites for this feature.
- **Branch note:** `feat/workout-enhancements` bundles unrelated work (orchestrator infra, backup, progress, finish sheet/rest timer in `app/workout/[splitId].tsx`). That is branch-level scope mixing, not defects in the pause/resume implementation itself.
- **Quality gates:** `typecheck`, `lint`, and `test` all exit 0 (56 tests, including 14 store + 14 route/prompt tests).

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; 56 tests passed.
- Store coverage exists for `leaveWorkout`, `resumeWorkoutEntry`, paused rehydration, index restore/clamping, abandon, and finish behavior.
- Route helper tests cover paused-session detection, workout-route suppression, legacy incomplete sessions, and cold-start foreground suppression.
- Static evidence supports ACs: leave persists `pausedAt` via `setActiveSession`, Home renders Today-card resume vs `PausedWorkoutResumeCard`, workout entry calls `resumeWorkoutEntry`, app root mounts `useResumeWorkoutPrompt`, and conflict handling still shows “Unfinished Workout.”
- Manual device behavior deferred to manual QA: actual tab browsing after pause, Android hardware back, stack gesture behavior, native alert presentation, and cold-start/foreground timing on device.
- Regression guard: current implementation preserves the recent pause/browse/resume/prompt behavior described by the listed commits; no regression found.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets in diff** — No `.env` values, API keys, or tokens appear anywhere. The single `process.env.APP_ENV` reference in `workoutStore.ts` only gates Zustand devtools visibility, not data access.

- **Storage keys** — All AsyncStorage keys are centralized in `src/storage/keys.ts` and namespaced (`sessions:active`, `sessions:all`, etc.). No new keys are introduced by this diff; `pausedAt` and `currentExerciseIndex` ride on the existing `ACTIVE_SESSION` key.

- **AsyncStorage read validation** — `getActiveSession()` uses `JSON.parse(raw) as WorkoutSession` without a runtime schema guard, but this is pre-existing behavior unchanged by this diff. The new pause/resume fields (`pausedAt`, `currentExerciseIndex`) written by `leaveWorkout` originate exclusively from `Date.now()` and in-memory Zustand state, both trusted sources — not from external or user-typed input. The index clamp in `loadActiveSession` (`Math.max(0, Math.min(...))`) correctly defends against a stale out-of-range index on rehydration.

- **AsyncStorage error handling** — All write paths (`setActiveSession`, `clearActiveSession`) throw on failure so callers can react. All read paths (`getActiveSession`, `getSessions`) catch and return a safe default, preventing unhandled promise rejections.

- **User input sanitization** — The only persisted user-typed string in this feature is the substitute exercise name, which is `.trim()`-ed in `substituteExercise` before storage (pre-existing). The `splitName` rendered in `PausedWorkoutResumeCard` and the resume alert is sourced from the session object, not directly from a text field — React Native's `Text` component is not susceptible to XSS.

- **Route construction from session data** — `router.push(\`/workout/${splitId}\`)` uses `splitId` sourced from `WorkoutSession.splitId`, which was originally produced by `generateId()` at split creation. This is not an external-input path and does not traverse the file system; Expo Router handles it as a typed client-side route.

- **No unsafe patterns** — No `eval`, no `Function()`, no dynamic `require()`, no shell commands, no file-picker paths anywhere in the diff.

- **No new dependencies or `.env` changes** — Confirmed; diff touches only existing packages and storage keys.

- **All 56 tests pass** (typecheck clean, lint clean) — automated gates confirm no regressions against the pause/resume store transitions and prompt-guard helpers.
