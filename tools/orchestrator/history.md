## Engineering decisions

### NativeWind / styling

- **Root `babel.config.js` is required for NativeWind v4.** Metro (`withNativeWind`), Tailwind (`nativewind/preset`), and `src/global.css` were already wired; missing Babel was the cause of unstyled screens (`className` ignored at build time).
- **Babel stack:** `babel-preset-expo` with `{ jsxImportSource: 'nativewind' }`, `nativewind/babel` preset, and `react-native-reanimated/plugin` as the **last** plugin.
- **Metro cache:** restart with `npx expo start -c` after Babel changes; transforms are not picked up on a warm Metro session.
- **Tab bar is not NativeWind.** `app/(tabs)/_layout.tsx` uses inline `style` and `src/shared/theme/colors.ts` — independent of the `className` pipeline.

### Screen headers

- **In-screen headers:** use shared `ScreenHeader` (`src/shared/components/ScreenHeader.tsx`) on tab roots, workout, and embedded detail views — not ad-hoc title rows.
- **Stack-pushed screens:** use Expo Router stack headers via shared `stackHeaderOptions` in `app/_layout.tsx` (dark bg, centered Inter bold title). Dynamic titles (e.g. split name) set with `navigation.setOptions`.

### Workout session init

- **Single sequenced mount flow** in `app/workout/[splitId].tsx`: `loadData()` (if needed) → `loadActiveSession()` → resume existing session or `startWorkout()` or error. Do not run parallel uncoordinated effects for hydration and session creation.
- **Screen init state machine:** `'loading' | 'ready' | 'error'` drives UI; missing split, zero exercises, or storage failure → error message + **Go Back**, not an indefinite spinner.
- **Store race guard:** `loadActiveSession` no-ops when `get().session != null` so a late hydration read cannot clear a session just created by `startWorkout`.
- **`startWorkout` persistence:** on `setActiveSession` failure, roll back in-memory session and rethrow so the screen can surface error instead of a stuck loading state.
- **Expo Router params:** normalize dynamic route ids before lookups — e.g. `const id = Array.isArray(splitId) ? splitId[0] : splitId ?? ''`.

### Workout pause / leave / resume

- **`leaveWorkout()` store action:** persists the current session + `currentExerciseIndex` to `ACTIVE_SESSION` without calling `clearActiveSession`. Resets only in-memory rest-timer state (same as discard); navigation to `/(tabs)` is the caller's responsibility.
- **`currentExerciseIndex` embedded on `WorkoutSession`:** optional field (default `0` on absent/legacy data) stored inside the existing `ACTIVE_SESSION` key — no new storage key. Written on `goToExercise`, `leaveWorkout`, `logSet`, `deleteSet`, and `substituteExercise`; hydrated in `loadActiveSession`. Both `goToExercise` and `loadActiveSession` clamp the value to `[0, exercises.length - 1]`; `loadActiveSession` also writes the clamped index back onto the in-memory `session` object so store state stays consistent with the corrected value. Skipped when `exercises.length === 0` (edge case; `goToExercise` guards OOB access independently).
- **`goToExercise` persistence:** fire-and-forget (`void setActiveSession`) — consistent with existing store patterns; silent divergence on storage failure is accepted.
- **`pausedAt?: number` on `WorkoutSession`:** explicit pause marker set by `leaveWorkout()` (`Date.now()`), cleared by `resumeWorkoutEntry(splitId)` when the matching workout screen mounts, and removed with the session on finish/abandon. No new storage key — serializes inside the existing `ACTIVE_SESSION` payload.
- **`resumeWorkoutEntry(splitId)` store action:** clears `pausedAt` and persists `currentExerciseIndex` for the matching split. Guard changed from `pausedAt === undefined` to `completedAt !== null` — legacy incomplete sessions (no `pausedAt`) are now synced on entry rather than skipped. No-ops when split differs or session is already completed. Called during workout screen bootstrap after a matching active session is found (before `setBootstrapState('ready')`).
- **Safe exit paths via `beforeRemove` + `BackHandler`:** both listeners present the cancel sheet instead of silently navigating away. `isLeavingIntentionallyRef` (set to `true` by finish, discard, and leave before navigation) bypasses the gate so intentional exits don't double-trigger the sheet. Ref is not reset — component remount on route replace makes this a non-issue.
- **`hasPausedSession` / `shouldPromptResumeSession` helpers in `workoutRoute.ts`:** `hasPausedSession(session)` requires both `completedAt === null` **and** `pausedAt != null` — legacy incomplete sessions without an explicit `pausedAt` (e.g. crash/kill) return `false` and do not trigger the Home resume card or app-return prompt. `shouldPromptResumeSession(session, pathname)` combines `hasPausedSession` + `!isWorkoutRoute` for a single prompt-eligibility predicate. Both exported via `src/features/workout/index.ts`. `isIncompleteActiveSession` (any incomplete session regardless of `pausedAt`) is kept separately for conflict-alert gating.
- **Home resume CTA is split-aware (two branches):** `pausedMatchesToday` (`showPausedResume && activeSession.splitId === todaySplit.id`) determines rendering. When true, the TODAY card primary CTA swaps to **Resume {splitName}** and `PausedWorkoutResumeCard` is hidden (`showPausedCard = false`) — avoiding a duplicate resume affordance. When false (different split, rest day, or no cycle), `showPausedCard` is true and `PausedWorkoutResumeCard` renders above Today while the TODAY CTA remains **Start Workout**.
- **Foreground and cold-start prompts both rehydrate before eligibility check:** `useResumeWorkoutPrompt` now calls `loadActiveSession()` inside both the cold-start path and the 300 ms foreground debounce before reading store state — ensures prompt eligibility reflects persisted storage, not stale in-memory Zustand state.
- **`useResumeWorkoutPrompt` hook mount scope:** moved from `app/(tabs)/_layout.tsx` to `app/_layout.tsx` so the prompt fires on root-stack routes (`/cycle`, `/progress`, etc.) where the tabs layout may be unmounted. Handles both cold-start and foreground-return paths. Cold-start alert was removed from `app/(tabs)/index.tsx` to avoid duplication.
- **Duplicate-alert guard:** `alertVisibleRef` (single-flight) + `coldStartPromptAtRef` with a 2 s `COLD_START_GUARD_MS` window suppress a foreground-return alert immediately after a cold-start alert. `isWorkoutRoute` check prevents the prompt while the user is already on the workout screen. Both helpers (`isWorkoutRoute`, `shouldSuppressForegroundPrompt`) and the exported `COLD_START_GUARD_MS` constant live in `src/features/workout/lib/workoutRoute.ts` (extracted for unit-testability; same pattern as `sortExercisesByPerformedOrder.ts`). Both helpers are re-exported from the feature barrel (`src/features/workout/index.ts`) alongside `hasPausedSession`, `isIncompleteActiveSession`, and `shouldPromptResumeSession`.
- **Conflict-alert Resume navigation:** when the user starts a different split while a session is paused, the conflict alert's Resume button calls `router.replace('/workout/${storeSession.splitId}')` — not `setBootstrapState('ready')`. Forcing ready on the wrong route left the user on the requested split with the paused split's data; replacing the route lets the correct screen run its own bootstrap/resume flow. `router` must be in the init-effect dependency array for this to be stable.
- **Leave dismisses all sheets; Discard dismisses only cancel sheet (intentional asymmetry).** `handleLeaveWorkout` calls `.dismiss()` on all five sheet refs (cancel, log, overview, substitute, finish) before navigating, ensuring no orphan modals on return. `handleDiscard` was left dismissing only the cancel sheet — the asymmetry predates this change and is outside the leave-path edge case.
- **Home loading gate covers both splits and session hydration:** `app/(tabs)/index.tsx` returns the blank `bg-surface-0` shell until both `isLoaded` (splits store) and `sessionLoaded` (workout store) are true. This prevents the Start Workout button from briefly rendering before `loadActiveSession` resolves and a paused session is known — a single boolean OR addition (`!isLoaded || !sessionLoaded`).
- **Home conflict guard via `startWorkoutForSplit`:** All "Start Workout" taps on Home (Today card and All Splits list) are routed through `startWorkoutForSplit(targetSplitId)`. Conflict check uses `isIncompleteActiveSession(activeSession)` (not `hasPausedSession`) so legacy incomplete sessions without `pausedAt` still trigger the "Unfinished Workout" alert (Discard → `abandonWorkout()` then push target; Resume → push paused split). `hasPausedSession` is used only to gate the `PausedWorkoutResumeCard` — the two predicates are intentionally separate. Same-split taps proceed directly. Alert uses `router.push` (not `replace`) — appropriate since no active workout screen is in the stack.

### Workout exercise swipe navigation

- **Gesture lives in `app/workout/[splitId].tsx`.** `ExerciseScreen` is presentation-only; pan + commit logic stay in the screen file.
- **Swipe scope via `renderSwipeable`:** optional `renderSwipeable(body)` on `ExerciseScreen`; parent wraps only the exercise body in `GestureDetector` + animated view. Header (cancel/progress/finish) and footer (+ Set) stay outside — wrapping the full screen blocks footer taps and breaks full-width footer layout.
- **Pan gating while logging:** `Gesture.Pan().enabled(!logSheetVisible)`.
- **Direction mapping:** swipe **left** → next or finish on last; swipe **right** → previous. Left commit exits to `-SCREEN_WIDTH`, right commit to `+SCREEN_WIDTH`; enter animates from the opposite edge (`commitSwipeNext` from `+SCREEN_WIDTH`, `commitSwipePrev` from `-SCREEN_WIDTH`).
- **Live drag:** `translateX = translationX` (1:1). Resistance (`BOUND_RESISTANCE = 0.35`) on exercise 1 only when swiping right (positive `translationX`); committed right swipe snaps back with no index change.
- **Commit sequence:** exit off-screen (`withTiming`, 200ms, cubic-out) → `runOnJS` index change / finish → reset `translateX` from opposite side → enter to 0. Never swap exercise content during snap-back.
- **Cancel release:** `withSpring(0, { damping: 20, stiffness: 300 })`.
- **Input lock:** `isTransitioning` blocks pan until exit+enter completes.
- **`ExerciseScreen` safe area:** `SafeAreaView` with `edges={['bottom']}` only; top inset from stack/parent.
- **+ Set footer:** RN `TouchableOpacity`, `w-full` inside `px-5` footer container (icon + label centered).
- **Directional UI (`ExerciseScreen`):** left = `chevron-left` (next) or `flag-checkered` (finish on last); right = `chevron-right` (back) or empty on first exercise.
- **First-workout hint:** `gesture-swipe-left`, `hintTranslateX` animates negative, copy “Swipe left to next exercise”.
- **Navigation haptics:** `light()` in `useWorkout` swipe handlers; manual finish button uses `success()`.
- **Finish interception via sheet:** final swipe (`afterSwipeFinish`) and header **Finish** button both open `FinishWorkoutSheet` (`BottomSheetModal`) — neither calls `finishWorkout()` directly. `ACTIVE_SESSION` is preserved until user explicitly confirms.
- **`afterSwipeFinish` resets animation state before presenting sheet** (clears `isAnimating` + `translateX`) so the sheet opens after the exit animation completes with no gesture conflicts.
- **`finishSheetVisible` wired into `sheetBlocksSwipe`** — mirrors the cancel/log/overview pattern; prevents swipe gestures while the finish sheet is open.

### Workout finish confirmation

- **`finishWorkout(completedAt?: number)`** — store action accepts an optional timestamp; defaults to `Date.now()`. Callers that supply a value (e.g. the finish sheet) control the persisted `completedAt`.
- **Unified confirm + navigate flow:** shared `handleConfirmFinish(completedAt)` in `app/workout/[splitId].tsx` calls `handleFinish(completedAt)` → `loadSessions()` → success haptic → dismiss sheet → `router.replace('/history/${sessionId}')`. Both swipe and button entries use this path — no divergent destinations.
- **Success haptic deferred to confirm:** moved from `useWorkout.handleFinish` to `handleConfirmFinish` in the screen so it fires only after the session is actually persisted, not on every finish intent.
- **Cancel / dismiss is a no-op:** `handleCancelFinish` does nothing beyond closing the sheet. The active session remains intact and the user can continue logging.
- **Date validation and clamping (local calendar day):** `isFutureCalendarDay` blocks confirm in the UI (button disabled + `opacity-40`). `dateToCompletedAtMs` uses end-of-local-day for the selected date; if the chosen day is before `startedAt`'s calendar day, returns `startedAt` verbatim; otherwise `Math.max(endOfSelected, startedAt)` guards the intra-day edge (e.g. workout started at 23:55 on same calendar day). All comparisons use local time, not UTC.
- **History date display:** `SessionCard` and `SessionDetail` both show `completedAt ?? startedAt`, preferring the user-confirmed date when present.
- **`autoAdvanceCycle` timing unchanged:** still runs only inside `finishWorkout` after successful save, so only after an explicit Confirm — never on cancel or dismiss.

### Workout log sheet

- **`present()` timing:** defer `BottomSheetModal.present()` one frame via `requestAnimationFrame`; effect cleanup cancels pending rAF and focus timer.
- **Bottom anchoring:** `bottomInset={0}` on `BottomSheetModal`; safe-area bottom is applied via `contentPaddingBottom` (`Math.max(insets.bottom, 40)`) instead — avoids double-padding that caused the sheet to float above the screen bottom. Sibling sheets (`ExerciseOverviewSheet`, `SubstituteExerciseSheet`) still use `insets.bottom` directly.
- **Notes input growth:** removed `NOTES_MAX_HEIGHT = 120` cap (root cause of ~2-line clipping). Notes `BottomSheetTextInput` uses `height: notesInputHeight` (state driven by `onContentSizeChange`) with `scrollEnabled={false}`; parent `BottomSheetScrollView` handles scroll. Minimum height stays at `NOTES_MIN_HEIGHT = 48`.
- **Keyboard avoidance scope:** `contentPaddingBottom` now adds padding for any focused field when keyboard is open (`focusedField !== null`), not only notes/RPE. Single `scrollFieldIntoView(focusedField)` effect replaces separate reps/notes effects — consistent avoidance across all fields.
- **`scrollNotesIntoView` strategy:** when keyboard is open, calls `scrollToEnd`; when closed, computes offset from `confirmOffset` + `CONFIRM_BUTTON_HEIGHT = 56`. `weight` and `reps` share `scrollRepsIntoView`; `rpe` with keyboard open routes to `scrollNotesIntoView`.
- **Reset on sheet close:** `resetSheetScrollState` (called from `handleSheetChange` when sheet index `< 0`) resets `focusedField`, `keyboardHeight`, `notesInputHeight`, `notesContentHeight` ref, and scroll offset. Keyboard-hide no longer resets notes height — notes stay expanded while the sheet is open.

### Haptics API

- **`useHaptics`** exposes `medium`, `heavy`, `light`, `success`. `impact` is a backward-compat alias for `medium`.
- **Cancel-sheet haptic weights:** `Heavy` for destructive actions (Discard), `Medium` for non-destructive exits (Leave Workout). Distinction is intentional — intensity signals consequence.
- **`app/workout/[splitId].tsx` uses raw `expo-haptics` directly** (not `useHaptics`) throughout the file. New additions in this file should follow the existing raw-call convention to avoid mixing two haptics patterns in one file.

### Orchestrator

- **Squad convention:** `.squad/` defines agents, ceremonies, and skills; CLI in `tools/orchestrator/` implements Standard ceremony.
- **Flow:** TicketMan → Implementer → gates (typecheck, lint, test) → 3-pass review (different models) → DecisionLog → traceability → commit.
- **CLI entry:** `orchestrate.mjs` delegates to `tsx tools/orchestrator/src/orchestrate.ts`; agent prompts live under `src/agents/`.
- **3-pass review:** Pass 1 code quality, Pass 2 tests/AC, Pass 3 security — models from `.squad/config.json → reviewModelOverrides`.
- **DecisionLog runs only after PASS** to keep this file current; capture durable decisions, not ticket/diff noise.
- **Reviewer stop conditions:** all 3 passes PASS + green gates → success + DecisionLog + traceability; any FAIL → retry until `ORCH_MAX_ITERS`.
