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
