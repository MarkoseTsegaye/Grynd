# Claude Code — Sprint 4 Prompt (Bug Fixes)

Read `CLAUDE.md` in full before touching any file. Read all previous sprint prompts
to understand the full context of what has been built.

Run `npx tsc --noEmit` after each fix. Zero type errors before moving on.

These are three isolated bugs. Fix them in order. Do not refactor anything outside
the direct blast radius of each fix.

---

## BUG-01 — Swipe direction is backwards

**Symptom:** Swiping left advances to the next exercise. It should be swiping RIGHT
that advances, swiping LEFT that goes back. This matches natural reading direction
and how every card-based UI (Tinder, flashcards, onboarding flows) works — forward
is right, back is left.

**Fix:**

Find the gesture handler managing exercise navigation in the active workout screen
(likely in `src/features/workout/hooks/useWorkoutSession.ts` or the workout screen
component itself).

The swipe direction is determined by the sign of the translation value at gesture end.
Swap the condition:

```ts
// WRONG (current behavior)
if (translationX < -SWIPE_THRESHOLD || velocityX < -SWIPE_VELOCITY_THRESHOLD) {
  goToNextExercise();
}
if (translationX > SWIPE_THRESHOLD || velocityX > SWIPE_VELOCITY_THRESHOLD) {
  goToPreviousExercise();
}

// CORRECT
if (translationX > SWIPE_THRESHOLD || velocityX > SWIPE_VELOCITY_THRESHOLD) {
  goToNextExercise();
}
if (translationX < -SWIPE_THRESHOLD || velocityX < -SWIPE_VELOCITY_THRESHOLD) {
  goToPreviousExercise();
}
```

Also update the visual swipe hint animation from Sprint 3 (`gesture-swipe-right` icon
sliding right) — this was already correct directionally but confirm the label reads
"Swipe right to advance" not "Swipe to next exercise" which was ambiguous.

Update the chevron hints on the workout screen:
- Right chevron (`chevron-right`) = next exercise — shown on right edge when not on
  last exercise. This was already correct — confirm it is still correct after the fix.
- Left chevron (`chevron-left`) = previous exercise — shown on left edge when not on
  first exercise. Confirm still correct.

On the last exercise the right edge shows `flag-checkered` (finish) — confirm this
is still wired correctly after the direction swap.

---

## BUG-02 — "+ Set" button does not work during an active workout

**Symptom:** Tapping "+ Set" on any exercise during a workout session does nothing.
The log sheet does not open.

**Investigation — trace this in order before writing any fix:**

1. Find the `+ Set` button's `onPress` handler. What does it call?
2. Find the state variable or ref that controls whether the log sheet is open
   (likely something like `isLogSheetOpen`, `showLogSheet`, or a `BottomSheetModal`
   ref's `.present()` call).
3. Identify which of these is broken:

   **Case A — The handler is not wired up:**
   The `onPress` on the `+ Set` Pressable is `undefined`, empty, or pointing to a
   function that was never passed down as a prop due to the component/hook decoupling.
   
   Fix: trace the prop chain from the workout screen → exercise card component →
   `+ Set` button and ensure `onPress={openLogSheet}` is connected at every level.

   **Case B — The BottomSheetModal ref is not attached:**
   `bottomSheetRef.current` is `null` when `.present()` is called because the
   `BottomSheetModal` component renders conditionally or is unmounted when the button
   is pressed.
   
   Fix: ensure `BottomSheetModal` is always mounted in the workout screen tree
   (not inside an `{isVisible && <BottomSheetModal />}` guard). Control visibility
   via `.present()` and `.dismiss()` on the ref, not via conditional rendering.

   **Case C — The gesture handler is swallowing the tap:**
   The swipe gesture handler wrapping the exercise card is intercepting the tap on
   "+ Set" before it reaches the Pressable.
   
   Fix: ensure the `PanGestureHandler` (or `Gesture.Pan()`) has
   `simultaneousWithExternalGesture` or `shouldCancelWhenOutside` configured so that
   taps on child Pressables are not consumed by the pan handler.
   
   If using the new Gesture API (`Gesture.Pan()`), add:
   ```ts
   .activeOffsetX([-20, 20])  // pan only activates after 20px horizontal movement
   ```
   This prevents the pan from stealing taps that have no horizontal movement.

**Fix whichever case applies.** If multiple cases are broken, fix all of them.
After fixing, the flow must work end to end:
1. Tap "+ Set" → log sheet opens
2. Enter weight and reps → tap confirm
3. Set appears as a chip below the exercise
4. Tapping the set chip deletes it with haptic feedback

---

## BUG-03 — "Loading workout..." shows indefinitely when starting a session

**Symptom:** Navigating to the active workout screen shows "Loading workout..." and
never resolves. The workout never starts.

**Investigation — trace the session initialization in order:**

The loading state is almost certainly a boolean (`isLoading`, `isInitializing`) in
the workout Zustand store or the screen's local state that is set to `true` on mount
and never set back to `false`.

1. Find where `isLoading` (or equivalent) is set to `true`. This is likely in:
   - `src/features/workout/store/workoutStore.ts` in the `startWorkout` action
   - Or in a `useEffect` in `src/features/workout/hooks/useWorkoutSession.ts`

2. Find where it is supposed to be set to `false`. Check for these failure modes:

   **Case A — Missing `finally` block:**
   The async initialization sets `isLoading = true`, does async work, then sets
   `isLoading = false` in the `try` block only. If any async call fails silently,
   the `catch` block does nothing and `isLoading` stays `true` forever.
   
   Fix: move `set({ isLoading: false })` to a `finally` block:
   ```ts
   try {
     // init work
   } catch (e) {
     console.error('Workout init failed:', e);
   } finally {
     set({ isLoading: false });
   }
   ```

   **Case B — Split or exercises fail to load from AsyncStorage:**
   `startWorkout(splitId)` reads the split and its exercises from AsyncStorage.
   If the split is not found (wrong ID, corrupted data, key mismatch), the function
   bails early or throws — and never clears the loading state.
   
   Fix: add a null-check guard after every AsyncStorage read in the init path:
   ```ts
   const split = await getSplitById(splitId);
   if (!split) {
     console.error(`Split ${splitId} not found`);
     set({ isLoading: false, error: 'Split not found' });
     return;
   }
   ```
   
   If `error` is set, the workout screen should show a brief error message and a
   "Go Back" button instead of the loading spinner. Do not leave the user stranded.

   **Case C — Race condition with navigation:**
   The workout screen mounts, reads `splitId` from route params, and calls
   `startWorkout(splitId)` in a `useEffect`. But the Zustand store action is async
   and the component reads `isLoading` before the store has hydrated from AsyncStorage
   on cold start.
   
   Fix: ensure the workout store hydrates (loads persisted state from AsyncStorage)
   before the workout screen attempts to read from it. In the root layout, await
   store hydration before rendering the navigator. Add a hydration guard:
   ```tsx
   // app/_layout.tsx
   const [hydrated, setHydrated] = useState(false);
   
   useEffect(() => {
     // Hydrate all stores
     Promise.all([
       useSplitsStore.getState().hydrate(),
       useWorkoutStore.getState().hydrate(),
       useHistoryStore.getState().hydrate(),
     ]).finally(() => setHydrated(true));
   }, []);
   
   if (!hydrated) return <SplashScreen />;
   ```

**Fix whichever case or combination of cases applies.**

After fixing, the flow must work end to end:
1. Tap "Start Workout" on the home screen
2. Workout screen loads immediately (under 300ms) showing the first exercise
3. No loading spinner visible after exercises are rendered
4. If a split genuinely cannot be found, show an error state with a back button —
   never an infinite spinner

---

## Acceptance Criteria

- [ ] Swiping right advances to the next exercise
- [ ] Swiping left goes back to the previous exercise
- [ ] Swipe hint label clearly says "Swipe right to advance"
- [ ] Chevron directions are correct (right = next, left = back)
- [ ] Last exercise right swipe still triggers finish flow
- [ ] Tapping "+ Set" opens the log sheet every time, without fail
- [ ] Entering weight + reps and confirming adds a set chip to the exercise
- [ ] The pan gesture does not swallow taps on the "+ Set" button
- [ ] Starting a workout resolves within 300ms — no infinite loading state
- [ ] If a split cannot be found, an error state with a back button is shown
- [ ] `isLoading` is always reset in a `finally` block in the workout init path
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No regressions to any Sprint 1, 2, or 3 features
