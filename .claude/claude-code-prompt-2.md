# Claude Code — Sprint 2 Prompt

Read `CLAUDE.md` in full before touching any file. All architecture, styling, and
decoupling rules from that file apply unconditionally to every line written here.
Also read `claude-code-prompt.md` to understand what was built in Sprint 1 — do not
regress any of it.

Run `npx tsc --noEmit` after each work item. Zero type errors before moving on.

---

## Context

Sprint 1 established: workout logging (reps + weight), history, splits management,
weekly schedule (day-assigned), and a `MaterialCommunityIcons`-based icon system.

Sprint 2 extends and replaces several of those features. Where Sprint 2 explicitly
replaces a Sprint 1 feature (weekly schedule → cycle schedule), remove the old
implementation cleanly. Do not leave dead code.

---

## Work Items

---

### BUG-01 — Weekly schedule modal does not render correctly

This bug is superseded by TASK-02 which replaces the weekly schedule entirely.
Do not fix this bug in isolation. When TASK-02 is implemented and the old schedule
screen is removed, this bug is resolved by deletion.

If for any reason TASK-02 is deferred, fix the modal by:
- Auditing the `position: absolute` / `zIndex` stack on the schedule bottom sheet
- Ensuring the modal container has an explicit `minHeight` that accommodates all content
- Checking that `KeyboardAvoidingView` is not clipping the sheet on iOS

Mark resolved when TASK-02 is complete.

---

### BUG-02 — Text inputs have off-center content and top cutoff

**Symptom:** Numeric inputs (reps, weight) appear vertically off-center inside their
containers. Text is clipped at the top on iOS.

**Root cause:** This is a known NativeWind + React Native `TextInput` interaction. The
default `lineHeight` computed by NativeWind conflicts with the native text rendering on
iOS when `font-mono` is applied to a `TextInput`.

**Fix — apply to every `TextInput` in the codebase:**

```tsx
// Add these props to every TextInput
textAlignVertical="center"      // Android
style={{ paddingTop: 0 }}       // iOS top-clip fix — inline style is the ONLY exception
                                 // to the no-inline-style rule, and only for this fix
```

Add a shared `NumericInput` component at `src/shared/components/NumericInput.tsx` that
wraps `TextInput` with these fixes pre-applied plus the standard NativeWind classes.
Replace every raw numeric `TextInput` in the codebase with `NumericInput`.

`NumericInput` props interface:

```ts
interface NumericInputProps {
  value: string;
  onChangeText: (val: string) => void;
  placeholder?: string;
  suffix?: string;          // rendered as a non-editable label to the right
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}
```

The suffix label (`kg`, `reps`, `lbs`) is part of this component — remove any
standalone suffix labels elsewhere that were handling this.

---

### TASK-01 — Reorderable splits and exercises

**Scope:** Two reordering surfaces:
1. The splits list on the splits tab (reorder which split comes first, second, etc.)
2. The exercise list inside a split (reorder exercises within a split)

**Library:** Use `react-native-draggable-flatlist`. Install it:

```bash
npx expo install react-native-draggable-flatlist
```

It is built on `react-native-gesture-handler` and `react-native-reanimated`, both of
which are already present via Expo.

**Splits list reordering (`app/(tabs)/splits.tsx`):**

- Replace the existing `FlatList` with `DraggableFlatList` from `react-native-draggable-flatlist`
- Each split row has a drag handle on the left: icon `drag-vertical`, 24px, `text-secondary`
- Drag handle activates long-press drag (`onLongPress` is the default — use `activationDistance={0}` for instant drag on the handle itself via `ScaleDecorator`)
- On drag end, persist the new split order to AsyncStorage immediately via
  `src/storage/adapters/splits.ts` → `saveSplits(reorderedSplits)`
- The split order in AsyncStorage is the canonical order — the splits list always reads
  and renders in storage order

**Exercise reordering within a split (split detail / edit screen):**

- The split edit screen shows exercises in the split as a `DraggableFlatList`
- Same drag handle pattern: `drag-vertical` icon on the left of each exercise row
- On drag end, update the `exerciseIds` array order in the split and persist immediately
- Reordering takes effect in the active workout immediately — the workout screen reads
  exercise order from the split at session start, so a reorder before starting is reflected

**Rules:**
- The drag handle is the only thing that activates drag — tapping the row still navigates
  or performs its normal action
- No reorder animation beyond what `DraggableFlatList` provides natively — do not add
  custom spring animations on top
- Zustand store must be updated in sync with AsyncStorage on every reorder — do not let
  them diverge

---

### TASK-02 — Replace weekly schedule with cycle-based schedule

**Remove entirely:**
- `app/schedule.tsx`
- `src/storage/adapters/schedule.ts`
- `STORAGE_KEYS.WEEKLY_SCHEDULE`
- The `WeeklySchedule` type
- The day-of-week pill row on the home screen
- The calendar-edit icon button in the splits tab header

**What replaces it:**

The user defines an **ordered cycle** of days. Each day in the cycle is either a split
or a rest day. The cycle repeats indefinitely. The app tracks which position in the cycle
is "today" based on when the last workout was completed (or manually advanced).

**Data model — add to `src/features/splits/types.ts`:**

```ts
interface CycleDay {
  id: string;                  // uuid
  type: 'split' | 'rest';
  splitId?: string;            // only when type === 'split'
}

interface WorkoutCycle {
  days: CycleDay[];            // ordered array, repeats indefinitely
  currentIndex: number;        // which CycleDay is "today"
  lastAdvancedAt: number | null; // Unix ms — when currentIndex was last incremented
}
```

Storage key — add to `src/storage/keys.ts`:

```ts
WORKOUT_CYCLE: 'cycle:workout',
```

Adapter — create `src/storage/adapters/cycle.ts`:

```ts
export async function getWorkoutCycle(): Promise<WorkoutCycle | null>
export async function saveWorkoutCycle(cycle: WorkoutCycle): Promise<void>
```

**Cycle editor UI — new screen `app/cycle.tsx`:**

- Reachable from splits tab via a `sync-circle` icon button in the header (replaces
  the old `calendar-edit` button)
- Screen title: "Training Cycle"
- Shows the cycle as a vertical `DraggableFlatList` of day cards
- Each card shows:
  - Drag handle (`drag-vertical`) on the left
  - If split day: split name + `dumbbell` icon
  - If rest day: "Rest" label + `sleep` icon, card background `surface-1` (slightly muted)
  - Delete button on the right: `close-circle`, 16px, `text-disabled` — tapping removes
    the day from the cycle
- At the bottom of the list: two buttons side by side
  - "Add Split Day" (`plus-circle-outline`) — opens an action sheet to pick which split
  - "Add Rest Day" (`sleep`) — appends a rest day immediately
- Cycle must have at least 1 split day — the delete button is disabled (visually dimmed)
  if removing it would leave zero split days

**Example valid cycle:**

```
[Push] [Pull] [Legs] [Rest] [Push] [Pull] [Legs] [Rest]
```

But the user could also do:

```
[Push] [Rest] [Pull] [Rest] [Legs] [Rest] [Rest]
```

There is no constraint on the shape. The user defines it freely.

**Cycle progression:**

- When a workout is completed (`completedAt` is set), call `advanceCycle()` in
  `src/features/splits/` — this increments `currentIndex` by 1 (wrapping at
  `days.length`) and sets `lastAdvancedAt` to `Date.now()`
- The cycle does NOT auto-advance based on calendar date — it advances only when a
  workout is finished
- If today's `CycleDay` is a rest day, "Start Workout" is not shown. Instead the
  "Today" card says "Rest Day" with the `sleep` icon and a "Mark Rest Done →" button
  that advances the cycle manually
- `currentIndex` is always `mod days.length` — it wraps cleanly

**Home screen today card (replaces the old day-assignment card):**

```
TODAY
[dumbbell icon]  Push          ← split name, text-2xl
                 Day 3 of 7    ← cycle position, text-secondary text-sm
[play-circle-outline]  Start Workout
```

Rest day variant:

```
TODAY
[sleep icon]  Rest Day
              Day 4 of 7
[arrow-right-circle-outline]  Mark Rest Done
```

Below the today card: a horizontal scrollable row showing the next 6 days in the cycle
(positions currentIndex+1 through currentIndex+6, wrapping). Each pill:
- Day offset label: "Tomorrow", "In 2 days", "In 3 days" … or just "+2", "+3" for space
- Split name (truncated to 8 chars) or "Rest"
- Pills are read-only — no tap action

---

### TASK-03 — Plate loading weight entry mode

**Context:** Users loading a barbell think in plates, not total weight. Entering "225 lbs"
requires mental math. This feature lets them enter plates directly and shows the
computed total.

**Two modes per weight entry — toggle between them:**

```
[kg/lbs]  [Plates]          ← mode toggle, shown above the weight input in the log sheet
```

**Mode A — straight weight (existing behavior, extended):**

- Single `NumericInput` for the total weight
- Unit toggle: `kg` | `lbs` — shown as a small pill toggle to the right of the input
- Conversion: store always in `weightKg`. Convert on read/write:
  ```ts
  // src/shared/lib/weight.ts
  export function lbsToKg(lbs: number): number { return lbs / 2.2046 }
  export function kgToLbs(kg: number): number { return kg * 2.2046 }
  ```
- The user's preferred unit is persisted in AsyncStorage under `STORAGE_KEYS.WEIGHT_UNIT`
  and loaded on app start. Add the key:
  ```ts
  WEIGHT_UNIT: 'prefs:weightUnit',   // 'kg' | 'lbs'
  ```
- All weight displays app-wide (set chips, history) must respect this preference and show
  the converted value with the correct unit label

**Mode B — plate loading:**

Standard Olympic barbell = 45 lbs (20.4 kg). The user enters the plates loaded on ONE
SIDE. The app computes total weight as:

```
total = barWeight + (sumOfPlatesOnOneSide × 2)
```

Bar weight default: 45 lbs. Make it configurable in a future sprint — for now hardcode
but put it behind a constant `BAR_WEIGHT_LBS = 45` in `src/shared/lib/weight.ts`.

**Plate entry UI:**

A row of plate buttons. Standard plate sizes:

```
[2.5] [5] [10] [25] [35] [45]   ← lbs plates
```

or in kg mode:

```
[1.25] [2.5] [5] [10] [15] [20]  ← kg plates
```

Show the correct set based on the user's unit preference.

Each button tap adds one of that plate to "one side". A plate counter appears above:

```
One side:   45 × 2   25 × 1   10 × 1
Total:      225 lbs
```

Display format for the plate summary: `{weight} × {count}` per unique plate, sorted
heaviest first.

A `remove` button (`minus-circle-outline`) next to each plate group in the summary
decrements that plate's count (disappears at 0).

The computed total weight is shown large in `text-2xl font-mono accent` color so the
user can verify at a glance.

**Confirm button** saves `weightKg` (converted from the computed total) and `reps` as
normal — the storage model does not change. Plate entry is a UI-only calculation.

**Mode persistence:** Remember the last-used mode per session (not persisted across
sessions — default to straight weight on app open).

---

### STORY-01 — Effort level per set (Failure + RPE)

**What the user needs:** After entering weight and reps, optionally tag the set with
an effort level. Two effort signals:

1. **Failure flag** — binary. Did they hit failure on this set? Yes / No.
2. **RPE** — Rate of Perceived Exertion, scale 1–10. Optional — can be left blank.

**Data model — update `LoggedSet`:**

```ts
interface LoggedSet {
  reps: number;
  weightKg: number;
  effort?: {
    toFailure: boolean;
    rpe?: number;          // 1–10, integer, optional
  };
  loggedAt: number;
}
```

`effort` is fully optional — existing sets without it are valid. Do not break old data.

**Log sheet UI — effort section below weight/reps:**

Add a third row to the log sheet, below weight and reps, separated by a thin
`border-t border-surface-2` divider. Label: "Effort (optional)" in `text-secondary text-sm`.

Left side — failure toggle:

```
[flame icon]  To Failure
```

- `flame` icon from MaterialCommunityIcons, 20px
- Tapping toggles between inactive (`text-disabled`) and active (`danger` color)
- Label changes: inactive = "To Failure", active = "Failed" in `danger` color

Right side — RPE input:

```
RPE  [  8  ]  / 10
```

- `NumericInput` (from BUG-02), width ~48px, centered
- Accepts integers 1–10 only. On blur, clamp: if > 10 set to 10, if < 1 set to 1,
  if non-numeric clear the field
- "/ 10" is a static label to the right
- Leave blank = RPE not recorded (valid)

**Set chip display — compact effort badge:**

Append to the chip after weight/reps:

```
Set 1 — 100 kg × 8    [FAIL]
Set 2 — 100 kg × 10   [RPE 8]
Set 3 — 100 kg × 12   [FAIL · RPE 9]
Set 4 — 100 kg × 6
```

- `[FAIL]` badge: `bg-danger/10 text-danger` (10% opacity bg), `text-xs`, `rounded-md`, `px-1.5 py-0.5`
- `[RPE N]` badge: `bg-surface-2 text-secondary`, same sizing
- If both: show `[FAIL · RPE N]` in a single badge, `bg-danger/10 text-danger`
- If neither: no badge — do not show a blank space

**History detail view:**

Same badge treatment on each set row in the session detail screen.

---

### STORY-02 — Show previous performance during active workout

**What the user needs:** When logging sets for an exercise, the user can see what they
did for the same exercise in the most recent previous session that included that exercise.

**Data lookup logic — add to `src/storage/adapters/sessions.ts`:**

```ts
export async function getPreviousPerformance(
  exerciseId: string,
  beforeSessionId: string    // exclude the current in-progress session
): Promise<LoggedExercise | null>
```

Implementation:
1. Load all sessions from AsyncStorage
2. Filter to sessions where `completedAt !== null`
3. Filter to sessions containing `exerciseId` in their `exercises` array
4. Sort by `completedAt` descending
5. Return the `LoggedExercise` entry from the most recent matching session, or `null`

This must be called once when the workout screen mounts for each exercise, or lazily
when the user arrives at an exercise via swipe. Lazy loading is preferred — fetch
previous performance only when the exercise becomes the active visible one.

**UI — "Last time" panel:**

Shown below the exercise name, above the "+ Set" button. Only rendered if previous
data exists — if `null`, render nothing (no "No previous data" placeholder).

```
┌─────────────────────────────────────┐
│  Last time  ·  [date]               │  ← surface-1 bg, text-secondary text-xs
│  Set 1   100 kg × 8   [RPE 8]       │
│  Set 2   100 kg × 10                │
│  Set 3   100 kg × 9   [FAIL]        │
└─────────────────────────────────────┘
```

- Container: `surface-1` background, `rounded-lg`, `px-4 py-3`, `border border-surface-2`
- Header row: "Last time" label (text-secondary, text-xs) + date formatted as `MMM D`
  (e.g. "Jun 3") — use native `Date`, no library
- Each set row: same format as set chips — `{weight} × {reps}` + effort badge if present
- Font: `font-mono` for numbers, `font-sans` for labels
- Max 5 sets shown. If more than 5, show first 5 + a muted "+N more" label
- This panel is read-only — no tap actions

**Date formatting — add to `src/shared/lib/date.ts`:**

```ts
export function formatShortDate(timestampMs: number): string {
  // Returns e.g. "Jun 3", "Dec 12"
  // Use Intl.DateTimeFormat with { month: 'short', day: 'numeric' }
}
```

---

### TASK-04 — History screen typography consolidation

**Problem:** The history screen mixes large bold headings (split name, date) with the
sleek mono set rows, creating visual noise. It is hard to scan.

**Fix — apply a consistent 3-level hierarchy across the history screen:**

**Level 1 — Session card header (date + split name):**

```
Jun 3                Push
```

- Date: `text-xs font-sans text-secondary` — left aligned
- Split name: `text-sm font-sans text-primary font-500` — right aligned (or inline)
- Remove any `text-xl`, `text-2xl`, or `font-bold` from session card headers entirely
- Card uses `surface-1` bg, `rounded-lg`, `px-4 py-3`

**Level 2 — Exercise name within a session:**

```
Bench Press   3 sets
```

- Exercise name: `text-sm font-sans text-primary`
- Set count summary: `text-xs font-sans text-secondary` — right aligned
- Separated from header by a `border-t border-surface-2`

**Level 3 — Set rows:**

```
Set 1   100 kg × 8   [RPE 8]
```

- "Set N": `text-xs font-sans text-disabled`
- Numbers: `text-sm font-mono text-primary`
- Effort badges: same as defined in STORY-01
- Left padding `pl-4` to visually indent under the exercise name

**Global rules for history screen:**

- No `font-bold` (weight 700) anywhere on this screen — use `font-500` for emphasis
- No `text-xl` or larger anywhere on this screen
- Consistent `gap-y-1` between set rows, `gap-y-3` between exercises, `gap-y-4`
  between session cards
- Session cards are NOT expandable/collapsible — show all exercises and sets inline.
  If a session has more than 4 exercises, show the first 4 and a muted "+N exercises"
  label at the bottom of the card.

---

## Acceptance Criteria

- [ ] `NumericInput` component exists, all numeric inputs use it, no vertical cutoff on iOS
- [ ] Splits list is reorderable via drag handle, order persists to AsyncStorage
- [ ] Exercises within a split are reorderable via drag handle, order persists
- [ ] Old weekly schedule screen and data model are fully removed — no dead imports or keys
- [ ] Cycle editor screen is reachable from splits tab
- [ ] Cycle supports any combination of split days and rest days in any order
- [ ] Completing a workout advances the cycle index by 1 (wrapping)
- [ ] Rest days show "Mark Rest Done" which also advances the cycle
- [ ] Home screen today card reflects the current cycle position
- [ ] Next-6-days pill row is visible and correct
- [ ] Weight entry has a straight weight mode and a plate loading mode
- [ ] Unit toggle (kg / lbs) persists to AsyncStorage and is respected app-wide
- [ ] Plate loading computes correct total: bar + (one side × 2)
- [ ] Logging a set can include failure flag and/or RPE (both optional)
- [ ] Set chips and history rows show effort badges correctly
- [ ] Effort data is stored in `LoggedSet.effort` and does not break old sets without it
- [ ] Previous performance panel appears on the active workout screen when data exists
- [ ] Previous performance panel is absent (not blank) when no prior session exists
- [ ] History screen uses no `font-bold` or `text-xl`+, only the 3-level hierarchy above
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No inline `style={{}}` props except the iOS `paddingTop: 0` fix in `NumericInput`
- [ ] No colors outside the custom token palette
- [ ] No `MaterialCommunityIcons` imports outside `src/shared/components/Icon.tsx`
