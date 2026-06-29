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
