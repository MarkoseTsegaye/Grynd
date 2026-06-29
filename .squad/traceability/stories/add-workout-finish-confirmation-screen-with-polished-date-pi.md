# Add workout finish confirmation screen with polished date picker
## Run 2026-06-29T02:45:37.208Z

Artifacts: `tickets/20260628-223703`

### Ticket
## Title

Add workout finish confirmation screen with polished date picker

## Context

Today, finishing a workout is immediate — no confirmation step. On the **last exercise**, a left swipe calls `afterSwipeFinish` in `app/workout/[splitId].tsx`, which runs `handleFinish()` → `finishWorkout()` and navigates away. The header **Finish** button follows the same path but navigates to `/(tabs)/history` instead of session detail.

`finishWorkout()` in `src/features/workout/store/workoutStore.ts` always sets `completedAt: Date.now()` before persisting. History UI (`SessionCard`, `SessionDetail`) displays `startedAt`, not `completedAt`.

The app already depends on `react-native-any-picker` and has a demo in `app/(tabs)/picker.tsx` (light iOS theme, MM/YY only). Workout flows use `@gorhom/bottom-sheet` modals (e.g. cancel workout sheet in `app/workout/[splitId].tsx`).

**Response mode:** Standard (multi-file feature, new UI + store change).

## Goal

After the user completes the **final swipe** on the last exercise (or taps **Finish**), show a polished confirmation screen where they can review a brief workout summary, adjust the workout date via a date picker, and explicitly confirm before the session is saved.

## Non-goals

- Changing swipe behavior on non-last exercises
- Redesigning history list or session detail layouts beyond date display
- Adding time-of-day picker (date only)
- Backfill/editing dates on already-completed sessions
- Removing or repurposing `app/(tabs)/picker.tsx` (may reuse its patterns only)
- New npm dependencies

## Requirements

1. **Intercept finish intent** — Neither final swipe nor **Finish** button may call `finishWorkout()` directly. Both open the confirmation UI while the session remains active in `ACTIVE_SESSION`.
2. **Confirmation UI** — Present a modal confirmation surface (prefer `BottomSheetModal` to match cancel/log sheets) titled for completion, showing:
   - Split name
   - Exercise count and total logged sets
   - Polished date picker defaulting to today
3. **Date picker polish** — Reuse `react-native-any-picker` `DatePicker` with a **dark theme** aligned to app surfaces (`#141414`, `#3D3B38`, accent/text tokens). Include a live formatted date display (e.g. `Jun 28, 2026`) above the wheel, rounded container, and spacing consistent with NativeWind patterns in `app/(tabs)/picker.tsx`.
4. **Confirm action** — Primary **Confirm** saves the workout with user-selected date, triggers success haptic, reloads history, and navigates to `/history/{sessionId}`.
5. **Cancel action** — **Cancel** / dismiss closes the sheet without persisting; user remains on the last exercise with workout still active.
6. **Custom `completedAt`** — Extend `finishWorkout(completedAt?: number)` to accept an optional timestamp (default `Date.now()`). Persist the chosen value on the saved session.
7. **Date validation** — Selected date must not be in the future. If selected calendar date is before `startedAt`'s calendar date, clamp `completedAt` to `startedAt` (or start of `startedAt`'s day — pick one approach and document in code). Disable **Confirm** or show inline error for invalid future dates.
8. **Unify navigation** — Swipe-finish and button-finish must share one post-confirm navigation path (session detail).
9. **History date display** — When `completedAt` is set, show `completedAt` (not `startedAt`) in `SessionCard` and `SessionDetail` headers.

## Acceptance criteria

- [ ] Swiping left on the **last exercise** opens the finish confirmation UI instead of immediately saving and navigating away
- [ ] Tapping **Finish** on the last exercise opens the same confirmation UI (not immediate save)
- [ ] Confirmation UI shows split name, exercise count, total sets, and a polished dark-themed date picker defaulting to today
- [ ] **Cancel** / sheet dismiss closes the UI without writing to `SESSIONS` or clearing `ACTIVE_SESSION`; user can continue the workout
- [ ] **Confirm** saves the session with the selected date as `completedAt`, clears the active session, reloads history, and navigates to `/history/{sessionId}`
- [ ] Future dates cannot be confirmed; past/today dates work, including backdating to the workout's start day
- [ ] Swipe-finish and button-finish use the same confirm + navigate flow (no divergent destinations)
- [ ] History cards and session detail show the confirmed date (`completedAt`) in the header
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` all pass

## Edge cases

- **Persistence failure on Confirm** — Stay on workout screen; show non-blocking error; do not navigate; active session remains recoverable
- **Double Confirm tap** — Disable confirm button / show loading while save is in flight
- **Sheet open during app background** — On return, sheet state preserved; no accidental save
- **Midnight / timezone** — Date comparison uses local calendar day, not UTC string slicing
- **Backdated `completedAt` before `startedAt` time** — Clamped so `completedAt >= startedAt`
- **Zero sets logged** — Confirmation still works; summary shows `0 sets`
- **Swipe animation + sheet** — Present sheet after swipe exit animation completes (current `afterSwipeFinish` timing); avoid gesture conflicts with sheet drag (`sheetBlocksSwipe` already exists — ensure finish sheet blocks swipe)
- **autoAdvanceCycle pref** — Still runs only after successful confirm + `finishWorkout`, not on cancel

## Implementation notes

### New files

- `src/features/workout/components/FinishWorkoutSheet.tsx` — `BottomSheetModal` with summary, polished `DatePicker`, Confirm/Cancel actions. Accept props: `session`, `sheetRef`, `onConfirm(completedAt: number)`, `onCancel`, `onChange` (for swipe blocking).
- `src/features/workout/components/WorkoutDatePicker.tsx` — Extracted dark-themed picker + live date label (reuse `react-native-any-picker`; do not copy light `iosTheme` from demo verbatim).
- `src/shared/lib/date.ts` — Add helpers, e.g. `formatDisplayDate(date: Date | number)` and `dateToCompletedAtMs(selected: Date, startedAt: number): number` for validation/clamping logic (unit-test these).

### Modify

- `app/workout/[splitId].tsx`
  - Add `finishSheetRef` and wire `sheetBlocksSwipe` when finish sheet is open (mirror cancel/log sheet pattern).
  - Replace `afterSwipeFinish` body: present finish sheet instead of calling `handleFinish()` directly.
  - Replace `ExerciseScreen` `onFinish`: present finish sheet instead of immediate finish.
  - Add shared `handleConfirmFinish(completedAt: number)` — calls `handleFinish(completedAt)` (or store directly), `loadSessions()`, `router.replace(\`/history/${sessionId}\`)`.
  - Add `handleCancelFinish` — dismiss sheet only.
- `src/features/workout/hooks/useWorkout.ts` — Change `handleFinish` to accept optional `completedAt?: number` and pass through to store; defer success haptic until confirm (move from pre-save to confirm handler if currently firing early).
- `src/features/workout/store/workoutStore.ts` — `finishWorkout: (completedAt?: number) => Promise<void>`; use `completedAt ?? Date.now()`.
- `src/features/history/components/SessionCard.tsx` — Header date: `formatShortDate(session.completedAt ?? session.startedAt)`.
- `src/features/history/components/SessionDetail.tsx` — Same date preference as `SessionCard`.

### Tests

- `src/features/workout/__tests__/workoutStore.test.ts` — Add case: `finishWorkout(customCompletedAt)` persists provided timestamp.
- `src/shared/lib/__tests__/date.test.ts` (new) — Cover `dateToCompletedAtMs` clamping (future rejected, before-`startedAt` clamped, today allowed).

### UX reference

- Bottom sheet chrome: match cancel sheet in `app/workout/[splitId].tsx` (`backgroundStyle`, handle, backdrop).
- Picker layout reference: `app/(tabs)/picker.tsx` live display + wheel, adapted to dark surfaces and full date format supported by `react-native-any-picker` (e.g. `MM/DD/YY` or equivalent).

## Test plan

### Automated

```bash
npm run typecheck
npm run lint
npm run test
```

### Manual (iOS and/or Android)

1. Start a workout with multiple exercises; swipe through to the last exercise.
2. Swipe left on the last exercise → confirmation sheet appears; workout is **not** yet in History.
3. Tap **Cancel** → sheet closes; still on last exercise; resume logging sets.
4. Swipe left again → change date to yesterday (if after workout start day) → **Confirm** → lands on session detail; History shows chosen date.
5. Start another workout; on last exercise tap **Finish** → same sheet → confirm → same session detail destination as swipe path.
6. Attempt to pick a future date → cannot confirm (disabled or error).
7. Confirm with persistence simulated failure (optional dev toggle) → stays on workout, no orphan history entry.
8. Verify dark picker readability, live date label updates while scrolling wheels, and sheet drag-to-dismiss behaves as cancel.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — Changes stay within the ticket: finish interception in `app/workout/[splitId].tsx`, new `FinishWorkoutSheet` / `WorkoutDatePicker`, `finishWorkout(completedAt?)`, date helpers + tests, history date display, and a one-line `vitest.config.ts` include. No unrelated files or new dependencies.
- **Regression guard** — Pause/leave/resume paths (`leaveWorkout`, `loadActiveSession`, `useResumeWorkoutPrompt`) are untouched. Finish no longer runs on swipe/button until confirm; active session stays in `ACTIVE_SESSION` until `finishWorkout` — consistent with pause/leave behavior, not a rollback of those commits.
- **Finish interception** — Swipe (`afterSwipeFinish`) and header **Finish** (`onFinish={presentFinishSheet}`) both open the sheet; neither calls `finishWorkout()` directly.
- **Unified confirm flow** — Shared `handleConfirmFinish` saves, reloads history, fires success haptic, dismisses sheet, and navigates to `/history/${sessionId}` for both entry points (fixes prior button → `/(tabs)/history` divergence).
- **Sheet / swipe integration** — `finishSheetVisible` is wired into `sheetBlocksSwipe`; `afterSwipeFinish` resets animation state then presents the sheet after exit animation.
- **Confirmation UI** — Summary (split name, exercise/set counts), dark-themed picker with live label, future-date inline error + disabled **Confirm**, loading guard on double-tap, persistence error handling in the sheet (stay on workout, no navigation).
- **Date logic** — Local calendar-day comparison, future rejection in UI, clamping documented and tested in `dateToCompletedAtMs` (before start day → `startedAt`; same day → end-of-day ≥ `startedAt`).
- **`autoAdvanceCycle`** — Still runs only inside `finishWorkout` after successful save, so only after **Confirm**, not on cancel/dismiss.
- **History display** — `SessionCard` and `SessionDetail` use `completedAt ?? startedAt`.
- **AGENTS.md patterns** — Zustand store change, NativeWind + bottom-sheet modal pattern (matches cancel sheet chrome), pure date helpers with unit tests, gates pass (`typecheck`, `lint`, `test`).
- **Minimal diff** — Focused additions; no full-file rewrites; no `any` escapes.
- **Minor pattern nits (non-blocking)** — `FinishWorkoutSheet` is imported via a deep path instead of the workout barrel (`LogSheet`, `SubstituteExerciseSheet`, etc. are re-exported from `src/features/workout/index.ts`). Success haptic uses `expo-haptics` directly in the screen (consistent with existing swipe/discard haptics there, though AGENTS recommends `useHaptics()`). `handleCancelFinish` is an intentional no-op; `onCancel` could be omitted without behavior change. `isBeforeCalendarDay` is exported but unused outside `date.ts`.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Verified AC evidence in diff: final swipe and Finish button both open `FinishWorkoutSheet`; saving only happens through shared confirm flow to `/history/{sessionId}`.
- Confirmation sheet shows split name, exercise count, total sets, dark themed picker, cancel/dismiss behavior, loading/error state, and future-date confirm disabling.
- `finishWorkout(completedAt?)` persists custom `completedAt`; history card/detail prefer `completedAt`.
- New date utilities have unit tests for display formatting, future-day detection, and local-day clamping.
- Automated gates are green: `typecheck`, `lint`, and `test` all exit 0; 35 tests passed.
- No regression found against listed recent commits.
- Manual-only visual/device checks, including picker polish, tap targets, sheet drag feel, and platform keyboard/gesture behavior, are deferred to manual QA.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

**Secrets / hardcoded credentials**
- No API keys, tokens, auth headers, or credentials anywhere in the diff or touched files. The only hardcoded string literals are UI surface hex colors (`#141414`, `#3D3B38`) and theme font tokens — acceptable constants, not secrets.

**Date validation**
- `isFutureCalendarDay` is called before every confirm in `FinishWorkoutSheet.handleConfirm` and the result drives `canConfirm`; the button is both visually disabled (`opacity-40`) and hard-disabled via the `disabled` prop, providing two layers of enforcement. ✓
- `dateToCompletedAtMs` in `date.ts` applies clamping: if the chosen calendar day is before `startedAt`'s day, `startedAt` is returned verbatim; the `Math.max(endOfSelected, startedAt)` guard also covers the intra-day edge case (e.g., workout started at 23:55 and user picks the same calendar day). ✓
- Seven unit tests in `date.test.ts` cover the clamping logic including the `endOfDay + 500ms > startedAt` edge case. ✓
- **Note (low risk):** `finishWorkout(completedAt?: number)` in the store does not re-validate the timestamp; any direct store caller could pass a future value. For a local-only React Native app where the store is not a public API surface, this is the accepted pattern and consistent with the rest of the codebase — no action required.

**Unsafe patterns**
- Double-confirm protection: `isConfirming` flag is set before the async call, cleared only on error, and the button is disabled while in-flight. ✓
- `void Haptics.notificationAsync(...)` fire-and-forget in `handleConfirmFinish` is correct for non-critical UX feedback; failure here must not block navigation. ✓
- `handleConfirmFinish` throws `new Error('No active session')` which propagates to `FinishWorkoutSheet.handleConfirm`'s catch block, which shows a safe, generic user-facing message — no internal stack details leak to the UI. ✓
- `bootstrapMessage` uses `String(err)` when surfacing bootstrap failures — this is pre-existing behavior, not introduced by this diff.
- `cancelSheetRef` / cancel-sheet paths (`abandonWorkout`, `leaveWorkout`) are untouched; pause/leave regression guard is intact. ✓

**AsyncStorage safety**
- No session data is written to AsyncStorage until the user explicitly taps Confirm. `ACTIVE_SESSION` persists the in-progress session throughout and is cleared only after `saveSession` succeeds, making crash recovery intact. ✓
- `saveSession` in `sessions.ts` uses a read-modify-write pattern that is susceptible to a TOCTOU race on concurrent calls; however, this pre-exists the diff and is out of scope here.
- `getActiveSession` deserialises with a plain `JSON.parse` cast — also pre-existing; no schema validation was added by this diff, consistent with the rest of the adapters.
- No sensitive PII enters AsyncStorage beyond user-created workout labels and numeric performance data, consistent with the app's pre-existing data model.

**Regression guard**
- Pause / leave active workout flows (`handleDiscard`, `handleLeaveWorkout`, `handleKeepGoing`, `abandonWorkout`, `leaveWorkout`) are untouched in the diff. The `sheetBlocksSwipe` expansion to include `finishSheetVisible` correctly mirrors the existing cancel/log sheet pattern and does not interfere with prior pause behaviour. ✓
- Success haptic moved from `useWorkout.handleFinish` to `handleConfirmFinish` — matches the ticket's explicit instruction to defer until confirm; no regression. ✓
