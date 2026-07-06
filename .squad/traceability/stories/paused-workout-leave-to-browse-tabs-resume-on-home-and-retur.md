# Paused workout: leave to browse tabs, resume on Home, and return prompt on app reopen
## Run 2026-06-29T04:09:31.902Z

Artifacts: `tickets/20260629-000136`

### Ticket
## Title

Paused workout: leave to browse tabs, resume on Home, and return prompt on app reopen

## Context

During an active workout, users sometimes need to leave the session screen to check splits, history, or settings without losing logged sets. Today the workout stack blocks accidental exit (back/swipe), but we need a deliberate **Leave Workout** path that persists progress, frees tab navigation, surfaces a **Resume** entry point on Home, and reuses the existing **Resume Workout?** alert when the app is backgrounded or killed.

Foundational pieces already exist (`leaveWorkout`, `pausedAt`, `PausedWorkoutResumeCard`, `useResumeWorkoutPrompt`). This ticket ensures the end-to-end user journey is complete, consistent, and covered by tests—not just partially wired.

## Goal

Allow users to explicitly pause (leave) an in-progress workout, browse the tab menu freely, resume from Home while paused, and see the familiar resume prompt when returning to the app after leaving.

## Non-goals

- Auto-pausing when the app backgrounds without the user choosing **Leave Workout**
- Resume CTA on tabs other than Home (Splits, History, Settings)
- Persisting or restoring rest-timer state across leave/resume
- Renaming **Leave Workout** to **Pause** in the cancel sheet (copy change only if needed for clarity)
- Changing finish/discard workout flows or history persistence

## Requirements

1. **Leave workout (pause)**
   - From the active workout screen, the cancel/exit affordance must offer **Leave Workout** alongside discard/keep options.
   - **Leave Workout** must persist the in-progress session (sets, exercise index, split metadata) to active-session storage and set `pausedAt`.
   - After leaving, navigate to the tab root (`/(tabs)`) so the user can browse all tabs without being trapped on the workout stack.
   - Accidental back/swipe exit must still be blocked unless the user confirms leave, discard, or finish.

2. **Home resume button**
   - When an active session has `pausedAt` set, Home must show a prominent resume card/button with the split name.
   - Tapping resume navigates to `/workout/[splitId]` and clears `pausedAt` on entry for the matching split.
   - The card must not appear for completed sessions or for in-progress sessions that were never explicitly left (no `pausedAt`).

3. **App return prompt**
   - On cold start and when returning from background, if there is a paused active session (`pausedAt` set, `completedAt` null) and the user is not already on a workout route, show the existing **Resume Workout?** alert (Resume / Discard).
   - Suppress duplicate prompts on cold start + immediate foreground (debounce/guard).
   - Do not prompt while the user is on `/workout/[splitId]`.

4. **Conflict handling (unchanged behavior, must not regress)**
   - Starting a different split while a paused/incomplete session exists must still show the unfinished-workout conflict alert (Resume current / Discard / cancel).

## Acceptance criteria

- [ ] From an active workout, choosing **Leave Workout** saves progress to active session storage, sets `pausedAt`, and lands the user on the tab menu with free navigation across Home, Splits, History, and Settings.
- [ ] After leaving, Home displays `PausedWorkoutResumeCard` (or equivalent) with the correct split name and a working **Resume** action.
- [ ] Tapping **Resume** on Home opens `/workout/[splitId]`, restores exercise index and logged sets, and clears `pausedAt` so the card disappears.
- [ ] After leaving a paused workout and backgrounding or force-quitting the app, reopening shows **Resume Workout?** with correct split name; **Resume** navigates to the workout and **Discard** clears the active session.
- [ ] No resume prompt appears when the user is already on a workout route, or when there is no paused session.
- [ ] Swipe/back from the workout screen without confirming leave/discard does not exit the workout or set `pausedAt`.
- [ ] Starting a different split while a paused session exists still blocks with the unfinished-workout conflict flow.
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` all pass.

## Edge cases

- User leaves workout, resumes from Home, leaves again—session updates `pausedAt` each time without data loss.
- User leaves workout, taps **Resume** on Home, then uses **Keep Going** / continues—no duplicate prompts or stale Home card.
- Cold start triggers resume alert; immediate foreground event must not show a second alert (guard window).
- Legacy active sessions in storage without `pausedAt` do not show Home resume card or app-return prompt (explicit leave only).
- Active session for split A paused; user attempts split B from Home or Splits—conflict alert, no silent overwrite.
- `loadActiveSession` not yet complete on Home—no flash of wrong UI; resume card appears once session is loaded.
- Android hardware back and iOS swipe-back both route through the same cancel sheet before leave.

## Implementation notes

**Response mode:** Standard ceremony.

**Likely files to touch (verify, wire, or extend—avoid duplicate implementations):**

| Area | Files |
|------|--------|
| Leave / exit UX | `app/workout/[splitId].tsx` — cancel bottom sheet (**Leave Workout**, `handleLeaveWorkout`, `beforeRemove` / back blocking, `isLeavingIntentionallyRef`) |
| Store & persistence | `src/features/workout/store/workoutStore.ts` — `leaveWorkout`, `resumeWorkoutEntry`, `loadActiveSession`; `src/storage/adapters/sessions.ts` — `getActiveSession` / `setActiveSession` |
| Route helpers | `src/features/workout/lib/workoutRoute.ts` — `hasPausedSession`, `shouldPromptResumeSession`, `shouldSuppressForegroundPrompt`, `isWorkoutRoute` |
| Home resume UI | `app/(tabs)/index.tsx` — `hasPausedSession`, `PausedWorkoutResumeCard`, `handleResumePausedWorkout`; `src/features/workout/components/PausedWorkoutResumeCard.tsx` |
| App-return prompt | `src/features/workout/hooks/useResumeWorkoutPrompt.ts`; mount in `app/_layout.tsx` |
| Types / exports | `src/features/workout/types.ts` (`pausedAt`), `src/features/workout/index.ts` |
| Tests | `src/features/workout/__tests__/workoutStore.test.ts`, `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts`; add/adjust cases for leave → home card visibility and prompt guards |

**Guidance:**

- Prefer extending existing `leaveWorkout` / `pausedAt` flow rather than new store fields.
- Keep persistence through `sessions:active` adapter only—no raw AsyncStorage in components.
- Ensure Home calls `loadActiveSession()` on mount so resume card survives app restart.
- Match existing typography/haptics patterns (`textRoles`, `useHaptics` where adjacent actions use haptics).

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

- Extend store tests: `leaveWorkout` sets `pausedAt` and persists; `resumeWorkoutEntry` clears `pausedAt` for matching `splitId`.
- Extend route/prompt tests: `hasPausedSession`, `shouldPromptResumeSession`, `shouldSuppressForegroundPrompt` for paused vs legacy incomplete sessions and workout-route suppression.

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

- **Scope:** The diff is a single line in `app/workout/[splitId].tsx` only. No unrelated files, no rewrites, no new dependencies.
- **Ticket alignment:** The ticket’s implementation notes call for matching haptics on adjacent cancel-sheet actions. `handleDiscard` already uses `Heavy`; adding `Medium` to `handleLeaveWorkout` fills that gap without touching leave/resume/prompt logic.
- **Regression guard:** The change does not alter `leaveWorkout`, navigation, `pausedAt`, sheet dismissal order, or `isLeavingIntentionallyRef`. It does not undo behavior from the listed orchestrator commits.
- **Patterns:** Haptic placement and `await` usage match `handleDiscard` in the same handler block. `Heavy` (destructive) vs `Medium` (non-destructive leave) is a reasonable split.
- **AGENTS.md:** Global guidance prefers `useHaptics()`, but this screen already uses raw `expo-haptics` (`handleDiscard`, swipe commit). The new line follows existing file convention rather than introducing a second pattern.
- **Minimal diff:** One additive line; no structural or behavioral refactor.
- **Quality gates:** `npm run typecheck`, `npm run lint`, and `npm run test` all reported exit code 0 (54 tests passing).

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Checked `.squad/skills/testing/SKILL.md` and applied Pass 2 criteria for CLI orchestrator review.
- Automated gates are green from provided outputs: `npm run typecheck`, `npm run lint`, and `npm run test` all exited `0`; 54 tests passed.
- Current diff only adds medium haptic feedback to `handleLeaveWorkout`; it does not undo the paused-workout behavior from recent commits.
- Static AC evidence is present: `leaveWorkout` persists active session with `pausedAt`, Home loads active session and shows `PausedWorkoutResumeCard`, route entry calls `resumeWorkoutEntry`, and app-level `useResumeWorkoutPrompt` handles cold start/foreground prompt suppression.
- Tests cover store pause/resume behavior and prompt helpers, including paused vs legacy sessions, workout-route suppression, and cold-start foreground guard.
- Conflict handling remains present for starting a different split while an incomplete active session exists.
- Manual-only UI/device checks, including actual tab browsing, iOS swipe-back, Android hardware back, and alert interaction on device, are deferred to manual QA per orchestrator rules.

---

# Pass 3 (pass3_security)

Now I have everything I need to complete the Pass 3 security review.

---

## Verdict
PASS

## Findings

- **Secrets in diff:** The diff is a single-line addition of `await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`. No API keys, tokens, `.env` references, or secrets of any kind are present.

- **AsyncStorage access pattern:** All AsyncStorage reads and writes are routed through `src/storage/adapters/sessions.ts` — no components (including `[splitId].tsx`) touch AsyncStorage directly except for the pre-existing `STORAGE_KEYS.HAS_SEEN_SWIPE_HINT` hint flag (a simple boolean string, zero sensitive data). The adapter layer is the correct single-access point per the ticket's implementation guidance, and this is fully respected by the diff.

- **AsyncStorage data validated on read:** `getActiveSession()` uses `JSON.parse(raw) as WorkoutSession` (a TypeScript cast, not runtime validation). This is a **pre-existing pattern** unchanged by the diff. The session shape is validated defensively downstream: `currentExerciseIndex` is clamped, `completedAt` is null-checked, and all callers guard on `session !== null`. The absence of a Zod/schema parse on cold-read is a pre-existing design choice outside this diff's scope.

- **User input sanitized where persisted:** The only user-free-text input path (`substituteExercise`) applies `.trim()` and guards on empty string before persisting. The `splitId` used in navigation (`router.push`, `router.replace`) originates from the in-memory Zustand store (which was loaded from persisted typed data), not from raw user typing. No new input paths are introduced by the diff.

- **Unsafe patterns (`eval`, dynamic `require`, shell commands):** None found anywhere in the diff or the supporting files reviewed.

- **File path handling from user/document picker:** Not applicable — no file picker or external path input in this feature.

- **`splitId` URL param used in navigation:** `useLocalSearchParams<{ splitId: string }>()` is a string that Expo Router validates against the file-system route. It is compared against the stored session's `splitId` before any navigation, so no open-redirect or path traversal risk.

- **Regression guard:** The haptics call is inserted *before* `leaveWorkout()` with `isLeavingIntentionallyRef.current = true` still set immediately after, preserving the intentional-leave guard. No behaviour from the commits listed is undone.
