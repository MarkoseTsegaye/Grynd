# Claude Code — Sprint 3 Prompt

Read `CLAUDE.md` in full before touching any file. All architecture, styling, and
decoupling rules apply unconditionally. Read `claude-code-prompt.md` and
`claude-code-prompt-2.md` to understand what was built in Sprints 1 and 2.

Run `npx tsc --noEmit` after each work item. Zero type errors before moving on.

---

## Context

Sprint 2 established: drag-reorder for splits/exercises, cycle-based schedule, plate
loading weight entry, effort tracking (RPE + failure), previous performance panel,
and history typography consolidation.

Sprint 3 focuses on: gesture polish, workout lifecycle integrity, navigation clarity,
developer experience, and two structural bug fixes.

---

## Work Items

---

### BUG-01 — DraggableFlatList drags scroll instead of dragging items

**Symptom:** Dragging a split row or exercise row in any `DraggableFlatList` just
scrolls the list. The drag never activates.

**Root cause:** `react-native-draggable-flatlist` requires gesture events to be
intercepted BEFORE the scroll handler sees them. This requires two things that are
almost certainly missing:

1. The `DraggableFlatList` must be wrapped in `GestureHandlerRootView` at the root
   layout level. If it is nested inside a plain `View` instead, scroll wins.
2. The drag handle must use `ScaleDecorator` + the `drag` prop passed to `renderItem`,
   and the `onLongPress` or `activationDistance` must be configured correctly.

**Fix — step by step:**

**Step 1 — Verify `GestureHandlerRootView` is at the root:**

Open `app/_layout.tsx`. The outermost element wrapping the entire app must be
`GestureHandlerRootView` with `style={{ flex: 1 }}`. If it is not, add it:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* rest of providers and Stack/Tabs */}
    </GestureHandlerRootView>
  );
}
```

There must be exactly ONE `GestureHandlerRootView` in the tree. Search the entire
codebase and remove any others — duplicates break gesture propagation.

**Step 2 — Fix the renderItem pattern in every DraggableFlatList:**

Every `renderItem` in a `DraggableFlatList` must follow this exact pattern:

```tsx
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';

renderItem={({ item, drag, isActive }: RenderItemParams<YourType>) => (
  <ScaleDecorator>
    <YourRowComponent
      item={item}
      isActive={isActive}
      onDragStart={drag}       // pass drag to the component
    />
  </ScaleDecorator>
)}
```

Inside `YourRowComponent`, the drag handle `Pressable` must call `onDragStart` via
`onLongPress` (NOT `onPress`):

```tsx
<Pressable onLongPress={onDragStart} delayLongPress={150}>
  <Icon name="drag-vertical" size={24} className="text-secondary" />
</Pressable>
```

`delayLongPress={150}` — 150ms is fast enough to feel instant but long enough to not
conflict with scroll. Do not set it to 0.

**Step 3 — Disable scroll during drag:**

`DraggableFlatList` accepts a `scrollEnabled` prop. It handles this internally when
dragging — do not manually control it. Just ensure no parent `ScrollView` is wrapping
the list. If there is a parent `ScrollView`, remove it — `DraggableFlatList` is itself
a scroll container.

Apply these three steps to every `DraggableFlatList` instance in the codebase:
- Splits list (`app/(tabs)/splits.tsx`)
- Exercises within a split (split edit screen)
- Cycle editor (`app/cycle.tsx`)

---

### BUG-02 — "Add Split Day" action sheet renders above the screen instead of bottom

**Symptom:** Pressing "Add Split Day" in the cycle editor shows the action sheet
anchored to the top of the screen or clipped outside the viewport.

**Root cause:** The action sheet / bottom sheet component does not have a portal
mechanism — it renders in the local component tree where its `zIndex` is constrained
by a parent with `overflow: hidden` or a conflicting `position: absolute` ancestor.

**Fix:**

Replace the custom action sheet with `@gorhom/bottom-sheet` which renders into a
portal at the root level. Install:

```bash
npx expo install @gorhom/bottom-sheet
```

Dependencies it requires (likely already present):
- `react-native-reanimated` ✓
- `react-native-gesture-handler` ✓

**Setup — add the `BottomSheetModalProvider` to `app/_layout.tsx`**, inside
`GestureHandlerRootView` but wrapping the navigation:

```tsx
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

<GestureHandlerRootView style={{ flex: 1 }}>
  <BottomSheetModalProvider>
    {/* Tabs / Stack navigator */}
  </BottomSheetModalProvider>
</GestureHandlerRootView>
```

**Replace the action sheet in `app/cycle.tsx`** with a `BottomSheetModal`:

```tsx
import { BottomSheetModal, BottomSheetFlatList } from '@gorhom/bottom-sheet';

// snapPoints control height — 40% is enough for a split picker list
const snapPoints = ['40%'];
```

The sheet shows the list of available splits (from the splits Zustand store) as a
`BottomSheetFlatList`. Each row: split name on the left, a `check` icon on the right
if already in the cycle. Tapping a row adds a new `CycleDay` of type `'split'` with
that `splitId` and dismisses the sheet.

**Apply `@gorhom/bottom-sheet` globally:** Any other bottom sheets or action sheets in
the app (log set sheet, weight mode picker) should also be migrated to
`BottomSheetModal` as part of this fix to prevent the same issue recurring elsewhere.
Migrate them all in this task — do not leave mixed sheet implementations.

---

### TASK-01 — Delete workout from history (swipe-to-delete)

**Mechanic:** Swipe a session card left to reveal a delete button. One tap on the
button deletes the session. No confirmation dialog.

**Library:** Use `react-native-swipeable` via `react-native-gesture-handler`'s
`Swipeable` component — it is already installed.

```tsx
import { Swipeable } from 'react-native-gesture-handler';
```

**Implementation:**

Wrap each session card in `Swipeable`:

```tsx
<Swipeable
  renderRightActions={() => <DeleteAction />}
  overshootRight={false}
>
  <SessionCard session={session} />
</Swipeable>
```

`DeleteAction` component:

- Fixed width: 80px
- Background: `danger` color
- Centered `trash-can-outline` icon, 24px, white (`text-primary`)
- No label — icon only
- `onPress` calls `deleteSession(session.id)` then closes the swipeable
- Add a haptic impact (`Haptics.impactAsync(ImpactFeedbackStyle.Medium)`) on delete

**Storage — add to `src/storage/adapters/sessions.ts`:**

```ts
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getSessions();
  const updated = sessions.filter(s => s.id !== sessionId);
  await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
}
```

**Zustand — add to the history store:**

```ts
deleteSession: async (id: string) => {
  await deleteSessionAdapter(id);
  set(state => ({ sessions: state.sessions.filter(s => s.id !== id) }));
}
```

**UX rules:**
- Only one swipeable open at a time — when a new swipe starts, close any open ones.
  Use a `ref` pattern with `Swipeable.close()` tracked via a `currentOpenRef`.
- The swipe reveal distance is exactly 80px — no overscroll beyond the button width.
- The session card background must be `surface-1` so the red delete zone contrasts
  clearly as it peeks through.

---

### TASK-02 — Swipe gesture as the primary workout navigation

**Current state:** Swipe left/right navigates between exercises. Chevron icons hint
at this. The mechanic works but is not communicated clearly on first use.

**Changes:**

**First-exercise onboarding hint (shown only once, first workout ever):**

On the first workout session (check `AsyncStorage` for a `prefs:hasSeenSwipeHint` key),
show an animated hint overlay when the workout screen first opens:

- A ghost hand icon (`gesture-swipe-right` from MaterialCommunityIcons) animates
  sliding right across the bottom of the exercise card
- Label below: "Swipe to next exercise" in `text-secondary text-xs`
- The animation runs once, then fades out after 2 seconds
- After the hint disappears, set `prefs:hasSeenSwipeHint = 'true'` in AsyncStorage
- Never show again after that

Add key to `src/storage/keys.ts`:
```ts
HAS_SEEN_SWIPE_HINT: 'prefs:hasSeenSwipeHint',
```

**Swipe physics — make it feel deliberate:**

The swipe gesture to advance exercises uses `react-native-reanimated` + `react-native-gesture-handler`. Configure it with these thresholds:

```ts
const SWIPE_THRESHOLD = 80;          // px before snap commits
const SWIPE_VELOCITY_THRESHOLD = 500; // px/s — fast flick also commits
```

If swipe does not meet threshold or velocity: snap back with a spring animation
(`withSpring`, default config). Do not let it feel floaty — the snap-back must be snappy.

**Progress indicator — replace the `2 / 6` text counter:**

Keep the `2 / 6` text but add a dot progress row above it:

```
● ● ◉ ○ ○ ○
  3 / 6
```

- Filled dot `●`: completed exercises (swiped past)
- Active dot `◉`: current exercise (slightly larger, `accent` color)
- Empty dot `○`: upcoming exercises
- Dot size: 6px filled/empty, 9px active
- Row is centered at the top of the workout screen
- Max 8 dots — if the split has more than 8 exercises, show 8 dots with the active one
  always centered in the row (sliding window)
- Use `accent` for active dot, `text-secondary` for filled, `text-disabled` for empty

**Edge behavior:**
- On the first exercise: left swipe does nothing (no bounce). Remove the left chevron.
- On the last exercise: right swipe triggers the "Finish Workout" confirmation (see
  TASK-03) rather than navigating forward. The right chevron becomes the
  `flag-checkered` icon on the last exercise.

---

### TASK-03 — Cancel workout (atomic void)

**What the user needs:** A way to exit an active workout and discard all logged sets
for that session. The session never gets written to history.

**Atomic behavior requirement:** The active session in progress must live ONLY in the
Zustand store (in memory) during the workout. It must NOT be written to
`STORAGE_KEYS.SESSIONS` until the user explicitly completes the workout via "Finish
Workout." `STORAGE_KEYS.ACTIVE_SESSION` can be used as a crash-recovery checkpoint
(see below) but is NOT the permanent record.

**Cancel flow:**

1. A "Cancel Workout" option is accessible via a `close` icon button in the top-left
   corner of the active workout screen (the header area, not overlapping the exercise card)
2. Tapping it opens a `BottomSheetModal` with two options:
   - **"Discard Workout"** — `trash-can-outline` icon, `danger` text color
   - **"Keep Going"** — `arrow-left` icon, `text-primary`
3. Tapping "Discard Workout":
   - Clears the Zustand active session store (sets to `null`)
   - Calls `clearActiveSession()` to remove `STORAGE_KEYS.ACTIVE_SESSION` from AsyncStorage
   - Does NOT call `saveSession()` — the session is voided completely
   - Navigates back to the home screen
   - Haptic: `ImpactFeedbackStyle.Heavy`
4. Tapping "Keep Going" dismisses the sheet, workout resumes

**Crash recovery (existing `ACTIVE_SESSION` key):**

The `ACTIVE_SESSION` key already exists for crash recovery. Ensure this flow is correct:
- On workout start: write the session skeleton to `ACTIVE_SESSION`
- After every set is logged: update `ACTIVE_SESSION` with the latest state
- On workout complete: write to `SESSIONS`, then delete `ACTIVE_SESSION`
- On workout cancel: delete `ACTIVE_SESSION`, do NOT write to `SESSIONS`
- On app cold start: check for `ACTIVE_SESSION`. If found, offer to resume or discard
  (a simple `Alert.alert` is fine for the resume prompt — no custom UI needed here)

---

### TASK-04 — Splits tab: edit and delete only, no "Start Workout"

**Current state:** Split cards on the splits tab have a "Start Workout" button.

**Change:** Remove "Start Workout" from the splits tab entirely.

The splits tab is for **managing splits** — creating, editing, reordering, deleting.
Starting a workout belongs exclusively to the home tab (via the today card or by
tapping a split on the home screen).

**Splits tab card — new action layout:**

```
[drag handle]  Push              [edit icon]  [delete icon]
               4 exercises
```

- Edit icon: `pencil-outline`, 20px, `text-secondary` — navigates to split edit screen
- Delete icon: `trash-can-outline`, 20px, `text-secondary` — see delete behavior below
- No "Start Workout" button, no `play-circle-outline` icon anywhere on this tab

**Delete split behavior:**

Tapping the delete icon opens a `BottomSheetModal` (not an `Alert`) with:
- Title: "Delete [Split Name]?"
- Body: "This cannot be undone. Any cycle days using this split will be set to rest days."
- "Delete" button: full width, `bg-danger`, `text-primary`
- "Cancel" button: full width, `bg-surface-2`, `text-secondary`

On confirm:
1. Remove the split from `STORAGE_KEYS.SPLITS`
2. Remove the split's exercises from `STORAGE_KEYS.EXERCISES` (only exercises that
   belong exclusively to this split — check if any other split references them first)
3. In the `WorkoutCycle`, find any `CycleDay` with `splitId === deletedSplitId` and
   set them to `{ type: 'rest', splitId: undefined }`
4. Update Zustand stores for splits and cycle
5. Haptic: `ImpactFeedbackStyle.Medium`

**Home tab — add split list:**

The home tab currently shows only the today card and the week pill row. Add a section
below the week pills titled "All Splits" (text-secondary text-xs uppercase tracking-wide)
listing all splits as tappable cards. Tapping a card starts that split's workout
immediately (same behavior as "Start Today's Workout" but for any split).

This is the only place in the app where "Start Workout" can be initiated for a
non-today split.

---

### TASK-05 — Hot reload (development only)

**What this means in Expo:** Expo's Fast Refresh is enabled by default and handles
component-level hot reload. This task is about ensuring it works correctly and adding
developer-experience improvements.

**Steps:**

1. Verify Fast Refresh is not accidentally disabled. Check `app.config.ts` and
   `metro.config.js` — there must be no `fastRefresh: false` anywhere.

2. Add a dev-only floating indicator that shows the current `APP_ENV`. Only visible
   when `APP_ENV === 'development'`. Position: bottom-right corner, above the tab bar.

   ```tsx
   // src/shared/components/DevBadge.tsx
   // Renders null in production
   // Renders a small pill: "DEV" in accent color, surface-2 bg, text-xs font-mono
   // position: absolute, bottom: 90, right: 16, zIndex: 999
   ```

   Render `<DevBadge />` inside the root layout, inside `GestureHandlerRootView`.

3. Ensure Zustand stores use the `devtools` middleware in development:

   ```ts
   import { devtools } from 'zustand/middleware';

   // Wrap store creator with devtools only in dev:
   const useWorkoutStore = create(
     process.env.APP_ENV === 'development'
       ? devtools(storeFn, { name: 'WorkoutStore' })
       : storeFn
   );
   ```

   Apply to all feature stores: splits, workout, history.

4. Add a `.env.development` file if it does not exist:

   ```
   APP_ENV=development
   EXPO_PUBLIC_APP_ENV=development
   ```

   And `.env.production`:

   ```
   APP_ENV=production
   EXPO_PUBLIC_APP_ENV=production
   ```

5. Update `package.json` scripts:

   ```json
   "scripts": {
     "start": "APP_ENV=development npx expo start",
     "start:prod": "APP_ENV=production npx expo start",
     "ios": "APP_ENV=development npx expo run:ios",
     "android": "APP_ENV=development npx expo run:android",
     "build:prod": "APP_ENV=production eas build --profile production",
     "typecheck": "tsc --noEmit",
     "lint": "eslint src/ app/"
   }
   ```

---

## Acceptance Criteria

- [ ] Dragging a split row activates drag (not scroll) after 150ms long press
- [ ] Dragging an exercise row activates drag (not scroll) after 150ms long press
- [ ] Dragging a cycle day activates drag (not scroll) after 150ms long press
- [ ] Exactly one `GestureHandlerRootView` exists in the app, at the root layout
- [ ] "Add Split Day" bottom sheet opens anchored to the bottom of the screen
- [ ] All bottom sheets / action sheets in the app use `@gorhom/bottom-sheet`
- [ ] Session cards in history can be swiped left to reveal an 80px red delete zone
- [ ] Tapping the delete zone removes the session from AsyncStorage and Zustand
- [ ] Only one swipeable is open at a time in the history list
- [ ] Swipe hint animation shows on first workout, never again after
- [ ] Swipe requires 80px or 500px/s velocity to commit — snaps back otherwise
- [ ] Dot progress indicator shows correct filled/active/empty states
- [ ] On last exercise, right swipe triggers finish flow (not a crash or blank)
- [ ] Cancel button is visible on the active workout screen
- [ ] Cancelling a workout clears the session from memory and AsyncStorage without saving to history
- [ ] Completing a workout saves to `SESSIONS` and clears `ACTIVE_SESSION`
- [ ] Cold start with a stale `ACTIVE_SESSION` prompts resume or discard
- [ ] Splits tab has no "Start Workout" button — only edit and delete
- [ ] Deleting a split converts its cycle days to rest days
- [ ] Home tab has an "All Splits" section for starting any split's workout
- [ ] `DEV` badge visible in development, invisible in production
- [ ] Zustand devtools middleware active in development only
- [ ] `npm start` runs with `APP_ENV=development`
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No inline `style={{}}` props except the iOS `paddingTop: 0` fix in `NumericInput`
- [ ] No colors outside the custom token palette
- [ ] No `MaterialCommunityIcons` imports outside `src/shared/components/Icon.tsx`
