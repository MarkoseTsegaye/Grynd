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
