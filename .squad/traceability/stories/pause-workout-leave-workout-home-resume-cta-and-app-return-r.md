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
## Run 2026-06-29T05:42:06.899Z

Artifacts: `tickets/20260629-013119`

### Ticket
## Title

Pause workout (Leave Workout), Home resume CTA, and app-return resume prompt

## Context

During an active workout, users cannot browse the rest of the app without discarding progress. They need to pause, use the tab menu (Home, Splits, History, Settings), and resume later without losing logged sets or exercise position.

Workout state lives in `useWorkoutStore` (Zustand) and persists via `src/storage/adapters/sessions.ts` (`sessions:active`). On `feat/workout-enhancements`, partial scaffolding already exists (`leaveWorkout`, `PausedWorkoutResumeCard`, `useResumeWorkoutPrompt`), but the end-to-end flow must be completed and verified as one cohesive feature.

**Ceremony:** Standard (multi-file feature, 3-pass review).

## Goal

Let users explicitly **Leave Workout** to pause an in-progress session, freely navigate the app, resume from **Home**, and see the familiar **“Resume Workout?”** alert when returning to the app after leaving it while paused.

## Non-goals

- Auto-pausing on background/app switch without the user choosing Leave Workout
- Resume CTA on non-Home tabs (Splits, History, Settings)
- Changing finish/discard flows or workout logging behavior
- Syncing paused state across devices
- Refactoring unrelated workout UI (log sheet, rest timer, notes)

## Requirements

1. **Leave Workout (pause)**  
   From the workout cancel sheet, **Leave Workout** persists the active session with `pausedAt` and `currentExerciseIndex`, then navigates to the tab root so the user can browse all tabs. **Discard Workout** and **Finish Workout** behavior must remain unchanged.

2. **Paused session persistence**  
   Paused sessions stay in `sessions:active` via `setActiveSession`. `loadActiveSession` rehydrates paused sessions on app launch and foreground.

3. **Home resume entry points**  
   When `hasPausedSession(session)` is true:
   - If the paused split **does not** match today's cycle split: show `PausedWorkoutResumeCard` above the Today card with **Resume {splitName}**.
   - If the paused split **matches** today's cycle split: replace the Today card **Start Workout** CTA with **Resume {splitName}** (no duplicate card).  
   Tapping resume navigates to `/workout/{splitId}`.

4. **App-return resume prompt**  
   On cold start and when returning from background/inactive, if a paused session exists and the user is **not** on a `/workout/*` route, show `Alert.alert('Resume Workout?', ...)` with **Discard** and **Resume** (same copy pattern as existing unfinished-workout alerts). Suppress duplicate prompts (e.g., cold-start guard window before foreground re-prompt).

5. **Re-entering the workout**  
   Navigating to `/workout/{splitId}` for a matching paused session calls `resumeWorkoutEntry`: clears `pausedAt`, restores `currentExerciseIndex`, and continues the session without restarting.

6. **Accidental exit protection**  
   `beforeRemove` / Android back guards on the workout screen apply only while the session is active and **not** paused. After resume, guards must re-engage (reset `isLeavingIntentionallyRef` on workout screen bootstrap if the screen is reused).

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
- [ ] After re-entering and resuming a paused workout, accidental back/swipe still opens the cancel sheet (exit guards active again).
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` all pass.

## Edge cases

- **No active session:** Leave Workout is a no-op; Home shows no resume UI; no app-return prompt.
- **Paused session, user on workout route:** No app-return prompt.
- **Legacy incomplete session without `pausedAt`:** Does not show Home resume card or app-return prompt; conflict guard on starting another split still applies. Do not auto-migrate unless trivial—document behavior only.
- **User dismisses Resume alert (cancelable):** Session stays paused; Home resume remains available.
- **Rapid foreground/background:** Debounced prompt; no alert spam.
- **Paused workout for deleted split:** Resume navigation surfaces existing workout bootstrap error/empty handling; do not crash.
- **Re-leave after resume:** Second Leave updates `pausedAt` again; guards apply only while actively in-session (not paused).

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

**Key patterns:**

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

- **Scope (feature code):** The implementation touches only ticket-listed areas — `workoutStore.ts`, `types.ts`, `workoutRoute.ts`, `[splitId].tsx`, Home (`index.tsx`), `_layout.tsx`, `PausedWorkoutResumeCard.tsx`, `useResumeWorkoutPrompt.ts`, `index.ts`, and the two test files. No unrelated app/src changes beyond the pause/resume slice.
- **Scope (branch hygiene):** Multiple orchestrator commits add large `.squad/traceability/stories/*.md` artifacts (~3.8k lines) that are outside the ticket file list. This is commit noise, not feature code creep; it does not affect runtime behavior.
- **Regression guard:** Checked cumulative behavior against the listed pause/resume commits. Core behaviors are present and intact: `leaveWorkout` sets `pausedAt` + persists index, `router.replace('/(tabs)')` on leave/discard, Home resume card vs Today inline CTA via `hasPausedSession`, `resumeWorkoutEntry` on matching bootstrap, root-mounted `useResumeWorkoutPrompt`, and exit guards gated on non-paused active sessions. The intentional narrowing from “any incomplete session” to `hasPausedSession` for Home card and app-return prompt matches the ticket edge case (legacy incomplete without `pausedAt` excluded).
- **AGENTS.md patterns:** Zustand store actions persist through `setActiveSession` / `clearActiveSession` (no raw AsyncStorage in components). NativeWind `className` on new UI. Expo Router navigation. Pure route helpers extracted to `lib/` with unit tests per “do not skip tests for new pure functions or store logic.”
- **Minimal diff:** Changes are additive and localized — ~17 lines in the store, a 35-line `workoutRoute.ts`, a 31-line card component, hook refactor (helpers moved out, foreground path rehydrates before eligibility check), and targeted wiring in three screens. No full-file rewrites.
- **Patterns & naming:** `hasPausedSession` / `isIncompleteActiveSession` separation matches ticket semantics (pause UI vs conflict guard). `isLeavingIntentionallyRef` reset on workout bootstrap (latest commit) correctly re-enables guards after screen reuse. Hook moved from tabs layout to root layout so prompts fire on non-tab routes.
- **TypeScript:** No new `any` in the pause/resume diff. Non-null assertions in `useResumeWorkoutPrompt` follow `shouldPromptResumeSession` guards.
- **Quality gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all exit 0 (56 tests, including leave/resume/rehydrate store tests and route/prompt helper tests).
- **Minor note (non-blocking):** `src/features/workout/index.ts` re-exports internal route helpers (`isWorkoutRoute`, `shouldPromptResumeSession`, `shouldSuppressForegroundPrompt`) that Home does not consume; tests import from `lib/workoutRoute` directly. Slightly wider public surface than necessary, but not a functional or pattern violation.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Checked `.squad/skills/testing/SKILL.md`; this is a CLI review, so manual device-only UI verification is deferred to manual QA.
- Automated gates are green from provided outputs: `npm run typecheck`, `npm run lint`, and `npm run test` all passed; 6 test files and 56 tests passed.
- `leaveWorkout` persists the active session with `pausedAt` and `currentExerciseIndex` via `setActiveSession`, without clearing `sessions:active`.
- Workout cancel sheet includes `Discard Workout`, `Leave Workout`, and `Keep Going`; Leave dismisses sheets, calls `leaveWorkout`, and `router.replace('/(tabs)')`.
- Home resume ACs have static evidence: `PausedWorkoutResumeCard` appears only for paused sessions that do not match today, and Today CTA becomes `Resume {splitName}` when paused session matches today.
- Resume entry navigates to `/workout/{splitId}` and workout bootstrap calls `resumeWorkoutEntry`, clearing `pausedAt` while preserving logged session data and restoring/clamping exercise index.
- App-return prompt is mounted in root layout, uses paused-session predicates, suppresses workout routes, debounces foreground prompts, and supports `Discard` clearing active session or `Resume` navigating to workout.
- Existing unfinished-workout conflict alert remains for starting a different split while any incomplete active session exists.
- Exit guards apply only when session is active and not paused; bootstrap resets `isLeavingIntentionallyRef`, so guards re-engage after resume.
- Store and route helper unit tests cover pause/resume storage transitions, rehydration, clamping, paused-vs-legacy incomplete predicates, workout-route suppression, and cold-start prompt suppression.
- Regression guard: no evidence that the current implementation undoes the recent pause/resume/home CTA/app-return prompt behavior.
- Deferred to manual QA: confirming native bottom-sheet presentation, physical tab browsing after Leave, background/force-quit alert behavior on device, and accidental back/swipe interaction UX.

---

# Pass 3 (pass3_security)

## Verdict
PASS

## Findings

- **No secrets in diff** — No API keys, tokens, `.env` values, or credentials appear anywhere in the changed files. `STORAGE_KEYS` are plain non-sensitive string constants.

- **AsyncStorage data validated on read** — `getActiveSession()` does `JSON.parse(raw) as WorkoutSession` with a `try/catch` fallback to `null`. The SKILL.md criterion scopes this check to "backup/import paths"; this codebase has no import/export surface — all storage is written exclusively by the app. The existing `normalizeSession` helper sanitizes numeric fields (`weightKg`, plate counts). Both `loadActiveSession` and `resumeWorkoutEntry` clamp `currentExerciseIndex` to valid bounds before applying it, which is the correct defensive pattern for untrusted persisted values.

- **User input sanitized where persisted** — `substituteExercise` trims the substitution name and guards against empty strings before writing to storage. `splitId` from `useLocalSearchParams` is used only for in-app routing and store lookups, never passed to filesystem paths or external services. `splitName` appears only in `Alert.alert` text (no HTML injection surface in native alerts).

- **No unsafe `eval`, dynamic requires, or shell commands** — None present anywhere in the diff.

- **File paths from user/document picker** — No file/document picker usage introduced in this feature.

- **Direct AsyncStorage in component** — `app/workout/[splitId].tsx` calls `AsyncStorage.getItem/setItem` directly for the swipe-hint flag (`HAS_SEEN_SWIPE_HINT`). This is a pre-existing pattern for a simple boolean UI preference unrelated to the new session lifecycle; the ticket's "no raw AsyncStorage" note targets session persistence specifically, and all new session writes (`leaveWorkout`, `resumeWorkoutEntry`) correctly go through `setActiveSession`/`clearActiveSession` in the adapter.

- **Prompt deduplication guards** — `alertVisibleRef`, `coldStartCheckedRef`, and `shouldSuppressForegroundPrompt` together prevent duplicate `Alert.alert` calls. `isWorkoutRoute` suppresses prompts when already on a workout screen. No alert-spam vectors identified.

- **`splitId` routing safety** — The value is a user-generated UUID stored and retrieved by the app; used only in `router.push`/`router.replace` calls. No path traversal or injection risk in Expo Router's routing layer.

- **No regressions against guarded commits** — `leaveWorkout`, `resumeWorkoutEntry`, `handleLeaveWorkout`, `PausedWorkoutResumeCard`, and `useResumeWorkoutPrompt` are all present and wired; the guard conditions (`session.pausedAt != null`, `isLeavingIntentionallyRef`) match the described behavior in the commit history.
