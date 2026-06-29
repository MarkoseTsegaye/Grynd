# Pause workout (Leave Workout), Home resume CTA, and app-return resume prompt
## Run 2026-06-29T05:30:48.892Z

Artifacts: `tickets/20260629-012553`

### Ticket
## Title

Pause workout (Leave Workout), Home resume CTA, and app-return resume prompt

## Context

During an active workout, users are trapped on the workout stack screen unless they discard progress. They need to pause, browse the tab menu (Home, Splits, History, Settings), and resume later without losing logged sets or exercise position.

The workout feature already uses Zustand (`useWorkoutStore`) with AsyncStorage persistence via `src/storage/adapters/sessions.ts` (`sessions:active`). Partial pause/resume scaffolding exists on `feat/workout-enhancements` (`leaveWorkout`, `PausedWorkoutResumeCard`, `useResumeWorkoutPrompt`), but a prior orchestrator run for this request failed QA (exit=1). This ticket scopes the complete, verified behavior.

**Ceremony:** Standard (multi-file feature, 3-pass review).

## Goal

Let users explicitly **Leave Workout** to pause an in-progress session, freely navigate the app, resume from **Home**, and see a **Resume Workout?** alert when returning to the app after leaving it while paused.

## Non-goals

- Auto-pausing on background/app switch without the user choosing Leave Workout
- Resume CTA on non-Home tabs (Splits, History, Settings)
- Changing finish/discard flows or workout logging behavior
- Syncing paused state across devices
- Refactoring unrelated workout UI (log sheet, rest timer, notes)

## Requirements

1. **Leave Workout (pause)**  
   - From the workout cancel sheet, a **Leave Workout** action persists the active session with `pausedAt` and `currentExerciseIndex`, then navigates to the tab root so the user can browse all tabs.
   - **Discard Workout** and **Finish Workout** behavior must remain unchanged.

2. **Paused session persistence**  
   - Paused sessions stay in `sessions:active` via `setActiveSession`.
   - `loadActiveSession` rehydrates paused sessions on app launch and foreground.

3. **Home resume entry points**  
   - When `hasPausedSession(session)` is true:
     - If the paused split **does not** match today's cycle split: show `PausedWorkoutResumeCard` above the Today card with a **Resume {splitName}** button.
     - If the paused split **matches** today's cycle split: replace the Today card **Start Workout** CTA with **Resume {splitName}** (no duplicate card).
   - Tapping resume navigates to `/workout/{splitId}`.

4. **App-return resume prompt**  
   - On cold start and when returning from background/inactive, if a paused session exists and the user is **not** on a `/workout/*` route, show `Alert.alert('Resume Workout?', ...)` with **Discard** and **Resume** actions (same copy pattern as existing unfinished-workout alerts).
   - Suppress duplicate prompts (e.g., cold-start guard window before foreground re-prompt).

5. **Re-entering the workout**  
   - Navigating to `/workout/{splitId}` for a matching paused session calls `resumeWorkoutEntry`: clears `pausedAt`, restores `currentExerciseIndex`, and continues the session without restarting.

6. **Accidental exit protection**  
   - `beforeRemove` / Android back guards on the workout screen apply only while the session is active and **not** paused (after Leave, user must not be blocked from leaving again if they re-enter and leave again).

## Acceptance criteria

- [ ] During an active workout, the cancel sheet offers **Leave Workout** alongside Discard and Keep Going; choosing Leave saves progress and lands the user on the tab navigator with all tabs accessible.
- [ ] After Leave, the session in storage has `pausedAt` set, `completedAt` null, and the correct `currentExerciseIndex`.
- [ ] Home shows `PausedWorkoutResumeCard` with a working **Resume** button when a paused workout exists and its split differs from today's scheduled split.
- [ ] Home Today card shows **Resume {splitName}** instead of **Start Workout** when the paused workout matches today's split.
- [ ] Tapping any Home resume control opens `/workout/{splitId}` and restores the prior exercise index and logged sets (session continues, not restarted).
- [ ] After Leave, backgrounding the app and returning (or killing and relaunching) shows **Resume Workout?** with Discard and Resume when not already on a workout screen.
- [ ] The app-return prompt does not appear when the user is already on `/workout/*`, and does not double-fire immediately after the cold-start prompt.
- [ ] **Discard** from the app-return prompt clears `sessions:active`; **Resume** navigates to the workout screen.
- [ ] Starting a different split while a paused (or other incomplete) session exists still shows the existing **Unfinished Workout** conflict alert (Discard / Resume).
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` all pass.

## Edge cases

- **No active session:** Leave Workout is a no-op; Home shows no resume UI; no app-return prompt.
- **Paused session, user on workout route:** No app-return prompt (already in workout context).
- **Legacy incomplete session without `pausedAt`:** Does not show Home resume card or app-return prompt; conflict guard on starting another split still applies. Do not broaden scope to auto-migrate unless trivial—document behavior only.
- **User dismisses Resume alert (cancelable):** Session stays paused; Home resume remains available.
- **Rapid foreground/background:** Debounced prompt; no alert spam.
- **Paused workout for deleted split:** Resume navigation should surface existing workout bootstrap error/empty handling; do not crash.
- **Re-leave after resume:** Second Leave updates `pausedAt` again; guards re-engage only while actively in-session (not paused).

## Implementation notes

Audit and complete existing code on `feat/workout-enhancements`; prefer fixing gaps over rewriting.

| Area | Files |
|------|--------|
| Session lifecycle (`leaveWorkout`, `resumeWorkoutEntry`, `pausedAt`) | `src/features/workout/store/workoutStore.ts`, `src/features/workout/types.ts` |
| Route/pause predicates | `src/features/workout/lib/workoutRoute.ts` |
| Persistence | `src/storage/adapters/sessions.ts`, `src/storage/keys.ts` |
| Leave UI + navigation guards | `app/workout/[splitId].tsx` (cancel sheet, `handleLeaveWorkout`, `beforeRemove` / `BackHandler`, `isLeavingIntentionallyRef`) |
| Home resume surfaces | `app/(tabs)/index.tsx`, `src/features/workout/components/PausedWorkoutResumeCard.tsx` |
| App-return prompt | `src/features/workout/hooks/useResumeWorkoutPrompt.ts`, mount in `app/_layout.tsx` |
| Public exports | `src/features/workout/index.ts` |
| Unit tests | `src/features/workout/__tests__/workoutStore.test.ts`, `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` |

**Key patterns to follow:**

- Persist via `setActiveSession` / `clearActiveSession` in the sessions adapter—no raw AsyncStorage in components.
- Use `hasPausedSession` (requires `pausedAt`) for Home card and app-return prompt; keep `isIncompleteActiveSession` for start-workout conflict guard.
- After Leave: `router.replace('/(tabs)')` (not push) so the workout stack is cleared.
- On workout entry bootstrap: call `resumeWorkoutEntry(splitId)` when session matches; do not call `startWorkout` for an existing paused session.
- Match existing alert copy: `'Resume Workout?'` / `'You have an unfinished ${splitName} workout.'`

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Store / helper unit tests** (extend existing suites):

- `leaveWorkout` sets `pausedAt`, keeps session in storage, preserves `currentExerciseIndex`.
- `resumeWorkoutEntry` clears `pausedAt`, restores clamped index.
- `hasPausedSession` / `shouldPromptResumeSession` / `shouldSuppressForegroundPrompt` cover paused vs incomplete-without-pause vs completed vs null.

**Manual QA (UI):**

1. Start a workout, log at least one set, advance to exercise 2+, tap header back → cancel sheet → **Leave Workout** → confirm landing on Home and ability to switch to Splits/History/Settings.
2. Return to Home → verify resume CTA (card or Today inline per split match) → tap Resume → confirm same exercise index and logged sets.
3. Leave again → background app (or force-quit) → reopen → confirm **Resume Workout?** alert; test both Resume and Discard paths.
4. With paused session, attempt to start a different split → confirm **Unfinished Workout** conflict alert still works.
5. Re-enter workout, confirm accidental back still opens cancel sheet (not silent exit) while session is active and unpaused.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope:** The diff is one line in `app/workout/[splitId].tsx` — no unrelated files, no scope creep. It targets requirement 6 (“guards re-engage only while actively in-session (not paused)”) and the “Re-leave after resume” edge case.
- **Correctness:** `isLeavingIntentionallyRef` is set `true` on finish, discard, and leave so `beforeRemove` / `BackHandler` skip the cancel sheet. After leave → resume, the ref can stay `true` if the screen is reused rather than remounted, which would leave exit guards disabled on an active session. Resetting it at bootstrap init restores guards once `resumeWorkoutEntry` clears `pausedAt`.
- **Regression guard:** Does not undo pause/resume behavior from the listed orchestrator commits (`leaveWorkout`, `pausedAt` persistence, Home resume, app-return prompt). It fixes accidental-exit protection after resume instead of removing it.
- **Minimal diff:** Single targeted reset at the start of the existing bootstrap `useEffect`; no rewrites or new abstractions.
- **Patterns / AGENTS.md:** Matches the existing ref + navigation-guard pattern in the same file. No new dependencies, no raw AsyncStorage for session data, no `any`, no unrelated anti-patterns.
- **Side effects:** Reset runs before async init; `beforeRemove` / `BackHandler` only attach when `bootstrapState === 'ready'` and `session.pausedAt == null`, so loading state is unchanged. Leave/discard/finish still set the ref to `true` synchronously before navigation.
- **Quality gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all reported exit 0 (56 tests).

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Verified `.squad/skills/testing/SKILL.md` guidance for Pass 2.
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all passed; tests show 6 files / 56 tests passing.
- Static AC evidence exists for Leave Workout persistence/navigation, Home resume card/inline CTA, app-return prompt, discard/resume prompt actions, conflict alert, and paused-session route suppression.
- Store/helper unit tests cover `leaveWorkout`, `resumeWorkoutEntry`, `loadActiveSession`, `hasPausedSession`, `shouldPromptResumeSession`, and foreground prompt suppression.
- Regression guard passed: the only working-tree diff resets `isLeavingIntentionallyRef` on workout screen bootstrap, which preserves/re-enables exit protection after re-entering and does not undo recent paused-workout behavior.
- Manual device-only checks, such as physical tab accessibility after Leave and native alert/keyboard/tap feel, are deferred to manual QA per CLI orchestrator guidance.

---

# Pass 3 (pass3_security)

## Verdict
PASS

## Findings

- **No secrets in diff**: The single-line diff (`isLeavingIntentionallyRef.current = false`) contains no API keys, tokens, `.env` references, or credentials. All surrounding files are equally clean.

- **AsyncStorage access pattern**: Session data is exclusively read and written through the adapter layer (`src/storage/adapters/sessions.ts`) via `getActiveSession` / `setActiveSession` / `clearActiveSession`. No session data is read or written with raw `AsyncStorage` calls in components. The one direct `AsyncStorage.getItem` / `setItem` in `[splitId].tsx` (lines 233–241) is for the swipe-hint boolean UI flag — a non-sensitive, non-session preference that predates this diff and is within acceptable scope.

- **AsyncStorage read validation**: `getActiveSession()` parses stored JSON and casts to `WorkoutSession` without a schema validator. This is a pre-existing pattern shared with the rest of the codebase and not introduced by this diff. The store's `loadActiveSession` applies defensive clamping on `currentExerciseIndex`, providing baseline resilience. For a local-only fitness app with no import path, the attack surface for crafted storage is negligible.

- **User input sanitized before persistence**: `substituteExercise` calls `.trim()` and early-returns on empty strings before persisting. Numeric inputs (`reps`, `weightKg`) enter the store as typed `number` parameters, not raw strings. Free-text `notes` are stored locally only, with no rendering surface that would introduce injection risk.

- **Route construction from stored data**: `splitId` values interpolated into `router.push`/`router.replace` paths originate from `session.splitId` (stored by the app itself) or from route params, not from arbitrary user-typed URLs. Expo Router resolves these as internal file-based routes, so there is no open-redirect or script-injection surface.

- **No unsafe patterns**: No `eval`, no `Function()`, no dynamic `require`, no shell commands, no document/file-picker paths in the diff or its directly touched files.

- **Regression check**: The diff's single line resets `isLeavingIntentionallyRef.current = false` at the start of the bootstrap `useEffect`. This correctly re-arms the accidental-exit guard when the workout screen mounts fresh, which is additive to — and consistent with — the guard behaviour described in all eight listed commits. No regression detected.
