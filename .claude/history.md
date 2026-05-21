# Agent Handoff — Sprint 3 Complete

## What was done (this session)

Implemented all work items from `.claude/claude-code-prompt-3.md`. Sprints 1 and 2 were already complete.

---

### BUG-01 — DraggableFlatList drag fixed

- `app/_layout.tsx` — `GestureHandlerRootView` changed from `className="flex-1"` to `style={{ flex: 1 }}` (required for gesture interception)
- `app/cycle.tsx`, `app/(tabs)/splits.tsx`, `app/splits/[splitId].tsx` — all drag-handle `TouchableOpacity` elements now have `delayLongPress={150}`
- Confirmed exactly one `GestureHandlerRootView` in the tree

---

### BUG-02 — Bottom sheets replaced with @gorhom/bottom-sheet

- Installed `@gorhom/bottom-sheet` v5.2.14
- `app/_layout.tsx` — `BottomSheetModalProvider` wraps all navigation inside `GestureHandlerRootView`
- `app/cycle.tsx` — "Add Split Day" modal replaced with `BottomSheetModal` + `BottomSheetFlatList`
- `src/features/workout/components/LogSheet.tsx` — `Modal` replaced with `BottomSheetModal` + `BottomSheetScrollView`; uses `keyboardBehavior="interactive"` for keyboard avoidance
- All other new sheets (cancel workout, delete split confirmation) also use `BottomSheetModal`

---

### TASK-01 — Swipe-to-delete in history

- `src/storage/adapters/sessions.ts` — added `deleteSession(sessionId)` function
- `src/features/history/store/historyStore.ts` — added `deleteSession` action
- `src/features/history/hooks/useHistory.ts` — exposes `deleteSession`
- `app/(tabs)/history.tsx` — session cards wrapped in `Swipeable` (from `react-native-gesture-handler`); swipe left reveals 80px danger-red delete zone with `trash-can-outline` icon; `currentOpenRef` pattern ensures only one swipeable open at a time; uses `FlatList` (replaced `ScrollView`)

---

### TASK-02 — Swipe gesture polish

- `src/storage/keys.ts` — added `HAS_SEEN_SWIPE_HINT: 'prefs:hasSeenSwipeHint'`
- `src/features/workout/components/ExerciseScreen.tsx` — rewrote header: cancel button (left), dot progress + `N / total` counter (center), finish button (right). Dot indicator: max 8 dots, sliding window, accent/secondary/disabled colors, inline style for 6px/9px dot sizes. Left chevron hidden on first exercise; right shows `flag-checkered` icon on last exercise. Added `onCancel` prop.
- `app/workout/[splitId].tsx` — swipe right = next (or finish on last); swipe left = prev. Commits on `translationX > 80` **or** `velocityX > 500`. `withSpring(0)` snap-back if threshold not met. First-workout swipe hint: reads `HAS_SEEN_SWIPE_HINT`, shows animated `gesture-swipe-right` icon + label, fades out after 2 s, sets key to never show again.

---

### TASK-03 — Cancel workout (atomic void)

- `app/workout/[splitId].tsx` — `close` icon button in ExerciseScreen header triggers a `BottomSheetModal` with "Discard Workout" (danger) and "Keep Going" options. Discard calls `abandonWorkout()` (clears `ACTIVE_SESSION`, does NOT write to `SESSIONS`) then navigates to `/(tabs)`. Haptic: `ImpactFeedbackStyle.Heavy`.
- Crash recovery: `app/(tabs)/index.tsx` — on home screen mount, calls `loadActiveSession()` then checks for a stale session; if found, `Alert.alert` prompts Resume or Discard.
- `workoutStore.ts` write semantics confirmed: `startWorkout` → writes `ACTIVE_SESSION`; `logSet`/`deleteSet` → updates `ACTIVE_SESSION`; `finishWorkout` → writes `SESSIONS` then clears `ACTIVE_SESSION`; `abandonWorkout` → only clears `ACTIVE_SESSION`.

---

### TASK-04 — Splits tab restructure

- `src/features/splits/components/SplitCard.tsx` — redesigned. Props: `onPress` (home tab, whole card → start workout), `onManage` + `onDelete` (splits tab, icon buttons). No "Start Workout" button remains anywhere on the splits tab.
- `src/features/splits/store/splitsStore.ts` — `deleteSplit` now: removes split, removes exercises used exclusively by that split, converts any cycle days with `splitId === deleted` to `{ type: 'rest', splitId: undefined }`, syncs cycle store via `useCycleStore.getState().loadCycle()`.
- `app/(tabs)/splits.tsx` — drag handle only; `SplitCard` shows `pencil-outline` (edit) and `trash-can-outline` (delete) icons. Delete opens a `BottomSheetModal` confirmation sheet. No "Start Workout" anywhere.
- `app/(tabs)/index.tsx` — "All Splits" section below the week pills: `text-secondary text-xs uppercase tracking-widest` label, all splits as tappable `SplitCard` (onPress → start workout). Also contains crash recovery Alert on mount.

---

### TASK-05 — Developer tooling

- `src/shared/components/DevBadge.tsx` — new component; renders `null` unless `process.env.APP_ENV === 'development'`; shows "DEV" pill (accent text, surface-2 bg, absolute bottom-right above tab bar)
- `app/_layout.tsx` — `<DevBadge />` rendered inside `BottomSheetModalProvider`
- Zustand `devtools` middleware added to all 5 stores (`PrefsStore`, `SplitsStore`, `CycleStore`, `WorkoutStore`, `HistoryStore`) with `enabled: process.env.APP_ENV === 'development'`; all stores migrated to curried `create<State>()()` pattern
- `.env.development` and `.env.production` created
- `package.json` scripts updated: `start`, `start:tunnel`, `start:prod`, `android`, `ios`, `build:prod`, `typecheck`, `lint`
- `app.config.ts` and `metro.config.js` verified — no `fastRefresh: false`

---

## Current state

- `npx tsc --noEmit` — **passes, zero errors**
- `npm run start` — launches with `APP_ENV=development`
- `npm run start:tunnel` — launches on tunnel

## Key architectural notes for next agent

- **All bottom sheets** use `@gorhom/bottom-sheet` `BottomSheetModal`. Never use React Native `Modal` for sheets.
- **Swipe direction**: right = forward/next, left = backward/prev. On last exercise, right swipe finishes.
- **Session lifecycle**: session lives ONLY in Zustand + `ACTIVE_SESSION` during workout. Only `finishWorkout()` writes to `SESSIONS`. `abandonWorkout()` clears without writing.
- **SplitCard variants**: `onPress` only = home tab (tappable card); `onManage` + `onDelete` = splits tab (icon buttons).
- **deleteSplit** handles full cleanup: exclusive exercises removed, cycle days converted to rest.
- No `MaterialCommunityIcons` imports outside `src/shared/components/Icon.tsx`.
- No colors outside the custom token palette.

## What to do next

Read `.claude/claude-code-prompt-3.md` to check if there is a `claude-code-prompt-4.md`. If so, read it in full and work through every item in order. Run `npx tsc --noEmit` after each item before proceeding.
