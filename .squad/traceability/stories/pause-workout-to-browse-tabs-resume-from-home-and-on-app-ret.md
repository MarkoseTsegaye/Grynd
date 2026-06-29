# Pause workout to browse tabs; resume from Home and on app return
## Run 2026-06-29T04:01:02.365Z

Artifacts: `tickets/20260628-235750`

### Ticket
## Title

Pause workout to browse tabs; resume from Home and on app return

## Context

Grynd already supports leaving an in-progress workout via the cancel sheet (“Leave Workout”), which calls `leaveWorkout()` in `workoutStore` and sets `pausedAt` on the persisted `WorkoutSession`. Home renders `PausedWorkoutResumeCard`, and `useResumeWorkoutPrompt` (mounted in `app/_layout.tsx`) shows a native `Alert` on cold start and when the app returns to the foreground.

Pause/resume detection is currently loose: `hasPausedSession()` in `src/features/workout/lib/workoutRoute.ts` treats **any** incomplete active session as “paused,” including a workout the user is still actively performing (no `pausedAt`). That can show the Home resume card and the return prompt when the user has not explicitly left the workout. The leave-to-browse flow exists, but resume affordances are not consistently tied to explicit pause (`pausedAt`).

## Goal

Let users intentionally pause a workout to browse the tab menu, then resume from Home while in the app, or via the familiar return prompt after leaving and reopening the app.

## Non-goals

- Auto-pausing when the app backgrounds while the user is still on the workout screen
- Persisting or restoring the in-set rest timer across leave/resume
- Adding a global resume banner on Splits, History, or Settings tabs (Home only for in-app resume CTA)
- Replacing the native `Alert` resume prompt with a new modal/bottom-sheet design
- Changing discard/finish workout behavior or multi-session support

## Requirements

1. **Explicit leave (pause)**  
   From `app/workout/[splitId].tsx`, “Leave Workout” must persist the session with `pausedAt`, navigate to `/(tabs)`, and allow free navigation across Home, Splits, History, and Settings without re-blocking.

2. **Home resume CTA**  
   When an active session has `pausedAt` set, Home (`app/(tabs)/index.tsx`) must show `PausedWorkoutResumeCard` with a Resume action that navigates to `/workout/{splitId}` and restores the session (existing `resumeWorkoutEntry` flow).

3. **App return prompt**  
   When the user leaves the app with an explicitly paused workout (`pausedAt`) and returns (cold start or foreground), show the existing “Resume Workout?” alert via `useResumeWorkoutPrompt`, with Discard and Resume actions. Do not prompt when the user is already on a workout route.

4. **Tighten pause semantics**  
   Resume UI and return prompts must key off explicit pause (`pausedAt`), not merely “incomplete session.” Legacy incomplete sessions without `pausedAt` should still be recoverable (e.g., conflict alert when starting another split) but must not trigger the Home resume card or app-return prompt.

5. **No duplicate prompts**  
   Preserve existing cold-start / foreground guard behavior so the user is not spammed with back-to-back alerts on launch.

## Acceptance criteria

- [ ] From an active workout, choosing “Leave Workout” saves the session with `pausedAt`, lands the user on the tab menu, and they can switch tabs without being forced back into the workout screen.
- [ ] While a workout is explicitly paused (`pausedAt` set), Home shows `PausedWorkoutResumeCard` with the correct split name; tapping Resume opens `/workout/{splitId}` and clears `pausedAt` via `resumeWorkoutEntry`.
- [ ] While a workout is explicitly paused, leaving the app and returning (cold start or background → foreground) shows the “Resume Workout?” alert when not on a workout route; Resume navigates to the workout, Discard calls `abandonWorkout`.
- [ ] An in-progress workout the user has **not** left (no `pausedAt`) does **not** show the Home resume card or the app-return resume prompt.
- [ ] Starting a different split while any incomplete session exists still shows the existing “Unfinished Workout” conflict alert (Discard / Resume).
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` all pass.

## Edge cases

- User pauses, resumes from Home, then backgrounds the app while still in the live workout → no resume prompt on return (no `pausedAt`).
- User pauses, taps Resume on Home, then immediately backgrounds before re-entering workout → session should not remain paused; no duplicate prompt after resume clears `pausedAt`.
- User dismisses the return alert without choosing Resume or Discard → session stays paused; Home card remains available.
- Legacy incomplete session in storage without `pausedAt` (crash/kill) → no Home card or return prompt; conflict alert still offered when starting another workout.
- User is on `/workout/{splitId}` when app returns → no resume alert.
- Cold start shows return prompt; foreground event within 2s → suppressed per `shouldSuppressForegroundPrompt`.
- Paused session references a deleted split → Resume navigates safely; existing workout-screen error/conflict handling applies (no crash).

## Implementation notes

**1. Pause detection helpers — `src/features/workout/lib/workoutRoute.ts`**

- Change `hasPausedSession()` to require `pausedAt != null` on an incomplete session.
- Keep `isIncompleteActiveSession()` for conflict/blocking logic.
- Update `shouldPromptResumeSession()` to use explicit pause semantics.
- Export helpers from `src/features/workout/index.ts` if Home/prompt consumers need both.

**2. Store (minimal) — `src/features/workout/store/workoutStore.ts`**

- No new actions expected; confirm `leaveWorkout` sets `pausedAt` and `resumeWorkoutEntry` clears it.
- Optionally add a small selector/helper (e.g., `isSessionExplicitlyPaused`) if it reduces duplication in screens.

**3. Workout screen leave flow — `app/workout/[splitId].tsx`**

- Verify “Leave Workout” still sets `isLeavingIntentionallyRef`, calls `leaveWorkout()`, and `router.replace('/(tabs)')`.
- Confirm `beforeRemove` guard does not block intentional leave.

**4. Home resume card — `app/(tabs)/index.tsx`**

- Gate `PausedWorkoutResumeCard` on explicit pause (`hasPausedSession` after semantic fix), not bare incomplete session.
- Keep `startWorkoutForSplit` conflict logic on `isIncompleteActiveSession` / existing unfinished-workout check.

**5. App return prompt — `src/features/workout/hooks/useResumeWorkoutPrompt.ts`**

- Relies on updated `shouldPromptResumeSession`; no Alert copy change unless needed for consistency (“unfinished” vs “paused”).
- Keep `alertVisibleRef` and cold-start guard to avoid double prompts.

**6. UI component — `src/features/workout/components/PausedWorkoutResumeCard.tsx`**

- Reuse as-is unless copy/a11y tweaks are needed for “paused” vs “unfinished.”

**7. Tests**

- Update `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` (workoutRoute helper tests): `hasPausedSession` false without `pausedAt`; `shouldPromptResumeSession` false for legacy incomplete-only sessions.
- Keep/adjust `src/features/workout/__tests__/workoutStore.test.ts` for `leaveWorkout` / `resumeWorkoutEntry` transitions.
- Add focused unit tests for any new helper exported from `workoutRoute.ts`.

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual (UI):**

1. Start a workout → cancel sheet → “Leave Workout” → confirm landing on tabs and ability to browse Splits/History/Settings.
2. Return to Home → confirm `PausedWorkoutResumeCard` visible → Resume → confirm workout restores at prior exercise/progress and `pausedAt` cleared.
3. Pause again → send app to background → reopen → confirm single “Resume Workout?” alert; test Resume and Discard paths.
4. Start workout, do **not** leave → background app → reopen on workout screen → confirm **no** resume alert and **no** Home resume card if navigating to Home without leaving.
5. With paused workout, attempt to start a different split from Home → confirm conflict alert still appears.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — Diff touches exactly three ticket-relevant files: `workoutRoute.ts` (pause semantics), `app/(tabs)/index.tsx` (Home gating + conflict logic), and `useResumeWorkoutPrompt.test.ts` (test alignment). No unrelated files, dependencies, or store/UI rewrites.

- **Minimal diff** — Core behavior change is one line in `hasPausedSession()` (`pausedAt != null`). Home change is limited to swapping the conflict guard from `showPausedResume` to `isIncompleteActiveSession`, which is required so legacy incomplete sessions (no `pausedAt`) still get the “Unfinished Workout” alert per requirement 4/5 without showing the resume card.

- **Ticket alignment** — Resume card (`showPausedResume = hasPausedSession`) and app-return prompt (`shouldPromptResumeSession` → `hasPausedSession`) now key off explicit pause only. Conflict detection remains on incomplete sessions regardless of `pausedAt`. Matches acceptance criteria 4 and 5.

- **Regression guard** — Does not remove leave/resume/prompt flows from prior orchestrator commits; it tightens *when* they fire. `leaveWorkout` / `resumeWorkoutEntry` in the store (unchanged) already set/clear `pausedAt`. No behavioral rollback of pause-to-browse, Home resume, or app-return alert for explicitly paused sessions.

- **AGENTS.md patterns** — Pure helpers stay in `src/features/workout/lib/`; consumers import via the feature barrel (`src/features/workout/index.ts`). Zustand persistence untouched in components. No anti-patterns (no `.env`, no full-file rewrites, no new deps).

- **TypeScript / naming** — `isIncompleteActiveSession` type guard correctly narrows `activeSession` in the conflict branch. JSDoc on `hasPausedSession` updated to match new semantics. No `any` escapes.

- **Tests** — Legacy incomplete cases flipped to `false` for `hasPausedSession` and `shouldPromptResumeSession`. Existing coverage for explicit pause, workout-route suppression, and cold-start guard retained. `npm run typecheck`, `lint`, and `test` all pass (54 tests).

- **Scope creep** — None identified. Optional store selector (`isSessionExplicitlyPaused`) was correctly skipped in favor of reusing `hasPausedSession`.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green from provided run: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; 54 tests passed.
- `hasPausedSession` and `shouldPromptResumeSession` now require explicit `pausedAt`, with unit coverage for paused, completed, null, workout-route, and legacy incomplete sessions.
- Home resume CTA is gated by `hasPausedSession`, while starting a different split still uses `isIncompleteActiveSession`, preserving the unfinished-workout conflict alert.
- Resume flow evidence is intact: Home routes to `/workout/{splitId}`, workout entry calls `resumeWorkoutEntry`, and store tests verify `pausedAt` is cleared.
- Leave flow evidence is intact: `leaveWorkout` sets `pausedAt`, intentional leave bypasses the navigation guard, and routes back to `/(tabs)`.
- App return prompt still uses the existing alert, skips workout routes, supports Discard/Resume, and retains cold-start/foreground suppression.
- Manual UI/device checks for tab browsing, visual card behavior, and native app background/foreground interactions are deferred to manual QA per CLI orchestrator guidance.
- No regression found against the listed recent commits.

---

# Pass 3 (pass3_security)

## Verdict
PASS

## Findings

- **No secrets in diff** — The three changed files (`app/(tabs)/index.tsx`, `workoutRoute.ts`, `useResumeWorkoutPrompt.test.ts`) contain no API keys, tokens, `.env` references, or hardcoded credentials.

- **AsyncStorage data validated on read** — The diff does not touch the read path (`getActiveSession` / `loadActiveSession`). The existing `loadActiveSession` clamps `currentExerciseIndex` to bounds before trusting it; that guard is unchanged. The new `session.pausedAt != null` check uses loose-equality null guard, which correctly catches both `null` and `undefined` on the optional `pausedAt?: number` field — this is the right pattern for an optional TypeScript property read from storage.

- **User input sanitized where persisted** — No new user-controlled input is introduced. `activeSession.splitName` rendered in the conflict `Alert` text originates from a stored split name (persisted via `Split.name` at split-creation time, not injected at display time). `substituteExercise` already trims user text before persisting; that path is untouched.

- **No unsafe `eval`, dynamic `require`, or shell invocations** — Nothing of the sort is present in the diff or in any file it touches.

- **Route/path construction** — `router.push(\`/workout/${activeSession.splitId}\`)` and `router.push(\`/workout/${targetSplitId}\`)` use stored UUIDs, not raw user input. In a React Native / Expo Router context (no browser address bar) this carries no meaningful injection risk.

- **No unsafe patterns** — The narrowed `hasPausedSession` logic is a pure boolean helper with no side effects and no I/O; `isIncompleteActiveSession` is likewise a pure type guard. Neither introduces new async or network surface.

- **Regression guard** — The tightened semantics (explicit `pausedAt` required for resume UI and return prompt) directly implement what the recent commits describe rather than undoing it. Legacy sessions without `pausedAt` no longer trigger the Home card or return alert, matching the ticket's intent and all recent commit messages.

## Required fixes

*(None — verdict is PASS.)*
