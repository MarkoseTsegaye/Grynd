# Claude Code — Sprint Prompt

Read `CLAUDE.md` in full before touching any file. Every rule there applies to all code
written below. Do not deviate.

---

## Context

This is a React Native + Expo workout logging app. Users log sets during active workouts.
Storage is AsyncStorage only. State is Zustand. Styling is NativeWind v4 with the custom
token palette defined in `CLAUDE.md`. Components are always decoupled from logic hooks.

---

## Work Items

Work through each item in order: bugs first, then stories, then tasks. After each item,
run `npx tsc --noEmit` and confirm zero type errors before moving to the next.

---

### BUG-01 — History screen shows no sessions

**Symptom:** The history tab renders but past workout sessions never appear, even after
completing a workout.

**Investigation steps — do these before writing any fix:**

1. Open `src/storage/adapters/sessions.ts`. Trace the full read path:
   - What key is being read from AsyncStorage?
   - Compare it exactly against `STORAGE_KEYS.SESSIONS` in `src/storage/keys.ts`.
   - If they differ by even one character, that is the root cause.

2. Open the Zustand store in `src/features/history/store/`. Find where sessions are loaded:
   - Is `getSessions()` being called?
   - Is it called on mount, or only on an event that never fires?
   - Is the result being set into state, or is the state setter never called?

3. Open `src/features/workout/` — find where a session is persisted when a workout ends:
   - Is `saveSession()` being called with a fully populated `WorkoutSession` object?
   - Is `completedAt` being set? If it is `null`, the session may be filtered out downstream.
   - Is the save happening before navigation away from the workout screen, or after
     (race condition)?

4. Open the history screen component in `app/(tabs)/history.tsx`:
   - Is the Zustand store being subscribed to correctly?
   - Is the load action being dispatched (e.g. in a `useEffect` on mount)?

**Fix requirements:**

- Fix the root cause found above. Do not add workarounds on top of a broken flow.
- The write path (end of workout → AsyncStorage) and read path (history screen mount →
  AsyncStorage → Zustand → render) must be fully traced and verified end to end.
- `completedAt` must be a `number` (Unix ms timestamp) on every saved session, never `null`.
  If a workout is abandoned without finishing, do not save it at all.
- After the fix, a completed workout must appear in the history list within the same app
  session and after a full app reload (cold start).
- Add a comment above the `saveSession` call: `// BUG-01 fix: ensure write completes before navigation`

---

### STORY-01 — Track weight + reps per set

**What the user needs:** When logging a set during an active workout, the user enters both
the weight lifted and the number of reps completed. Both values are saved per set.

**Data model changes:**

Update `LoggedSet` in `src/features/workout/types.ts`:

```ts
// Before
interface LoggedSet {
  reps: number;
  loggedAt: number;
}

// After
interface LoggedSet {
  reps: number;
  weightKg: number;   // always stored in kg internally
  loggedAt: number;
}
```

No other fields. Do not add `weightLb` — unit conversion is a display concern, not a
storage concern.

**Log sheet UI (the bottom sheet / modal that opens when tapping "+ Set"):**

- Two inputs side by side: `Weight` on the left, `Reps` on the right
- Weight input: numeric keyboard, placeholder `0`, suffix label `kg`
- Reps input: numeric keyboard, placeholder `0`, suffix label `reps`
- `Reps` input must auto-focus first (it was the only input before; keep existing muscle memory)
- After entering reps, the user can tab/next to weight, or vice versa — both must work
- Both fields are required. The confirm button is disabled (visually dimmed, not pressable)
  until both fields contain a value > 0
- Use `font-mono` for both input values — numbers must be scannable at a glance

**Set chip display (the logged set list under the current exercise):**

```
Set 1 — 100 kg × 8 reps
Set 2 — 100 kg × 10 reps
```

- Format: `{weightKg} kg × {reps} reps`
- Use `font-mono` for the numbers, `font-sans` for the labels
- Chip tap to delete still works as before (no confirmation, immediate haptic)

**History detail view:**

Each logged exercise in a past session must display its sets in the same format:
`{weightKg} kg × {reps} reps`

**Migration:**

Existing sessions in AsyncStorage will have sets without `weightKg`. When reading old
sessions, default missing `weightKg` to `0` so the app does not crash. Add this
defensive read in `src/storage/adapters/sessions.ts`:

```ts
weightKg: set.weightKg ?? 0,
```

---

### STORY-02 — Weekly split schedule

**What the user needs:** The user assigns splits to days of the week (Mon–Sun). When they
open the app, today's split is surfaced at the top of the home screen so they never have
to think about what to train.

**Data model — add to `src/features/splits/types.ts`:**

```ts
type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface WeeklySchedule {
  [day in DayOfWeek]?: string;  // value is a splitId, undefined = rest day
}
```

Store the schedule under `STORAGE_KEYS.WEEKLY_SCHEDULE` in `src/storage/keys.ts`.
Add the key:

```ts
WEEKLY_SCHEDULE: 'schedule:weekly',
```

Create a typed adapter `src/storage/adapters/schedule.ts`:

```ts
export async function getWeeklySchedule(): Promise<WeeklySchedule>
export async function saveWeeklySchedule(schedule: WeeklySchedule): Promise<void>
```

**Schedule editor UI — new screen `app/schedule.tsx`:**

- Accessible from the splits tab via a calendar icon button in the header (top right)
- Shows a 7-row list: Mon → Sun
- Each row has the day name on the left and a split picker on the right (a pressable
  that opens an action sheet / bottom sheet listing all splits + a "Rest day" option)
- Rest days show a muted "Rest" label, not a split name
- Changes save immediately on selection (no separate save button)
- The screen title is "Weekly Schedule"

**Home screen changes (`app/(tabs)/index.tsx`):**

- At the top of the screen, above the splits list, add a "Today" card
- The card shows:
  - Day name (e.g. "Monday") in `text-secondary`
  - Split name in `text-2xl text-primary font-sans` — or "Rest Day" if no split is assigned
  - If a split is assigned: a "Start Today's Workout" button using the `accent` color
  - If it is a rest day: no CTA button, just the rest day label
- The "Today" card uses `surface-1` background
- Below the today card, the existing splits list remains unchanged

**Day resolution:**

Use `new Date().getDay()` mapped to the `DayOfWeek` type. Sunday = `sun`, Monday = `mon`,
etc. Do this mapping in a pure utility function in `src/shared/lib/date.ts`:

```ts
export function getTodayKey(): DayOfWeek { ... }
```

Do not use any date library. Native `Date` only.

**Rolling day display (next to the today card):**

Below the today card, show a horizontal scrollable row of the remaining days of the week
(tomorrow through Sunday, then wrapping Mon–today). Each pill shows:
- Abbreviated day name (`Tue`)
- Split name truncated to 10 chars, or `Rest`
- Today's pill uses `accent` background with `surface-0` text
- Other days use `surface-2` background with `text-secondary` text

---

### TASK-01 — Gym-oriented icons throughout the app

**Icon library:** Use `@expo/vector-icons` with the `MaterialCommunityIcons` set. It has
the most complete gym/fitness icon vocabulary. Install if not already present.

Do not use generic icons where a gym-specific one exists. The list below is exhaustive —
do not add icons beyond what is listed here without a clear UX reason.

**Icon map — use exactly these icon names:**

| Location | Icon name | Notes |
|---|---|---|
| Home tab bar | `home-outline` | Inactive state |
| Home tab bar | `home` | Active state |
| History tab bar | `calendar-month-outline` | Inactive |
| History tab bar | `calendar-month` | Active |
| Splits tab bar | `format-list-bulleted` | Inactive |
| Splits tab bar | `format-list-checks` | Active |
| "Start Workout" button | `play-circle-outline` | Left of label |
| "+ Set" log button | `plus-circle-outline` | Left of label |
| Delete set chip | `close-circle` | Right of chip, danger color |
| Finish workout | `flag-checkered` | Left of label |
| Next exercise (swipe hint) | `chevron-right` | Shown at right edge of screen |
| Previous exercise (swipe hint) | `chevron-left` | Shown at left edge, only if not first |
| Exercise count badge | `dumbbell` | Left of `2 / 6` counter |
| Schedule screen nav | `calendar-edit` | In splits tab header |
| Rest day indicator | `sleep` | Next to "Rest" label |
| Add exercise to split | `plus` | In splits management |
| Empty history state | `clipboard-text-outline` | Centered empty state illustration |
| Empty splits state | `dumbbell` | Centered empty state illustration |

**Icon sizing rules:**

- Tab bar icons: 24px
- In-button icons: 20px
- Inline / chip icons: 16px
- Empty state illustrations: 48px, `text-disabled` color

**Implementation rules:**

- Icons are always rendered in a dedicated `Icon` wrapper component at
  `src/shared/components/Icon.tsx` that accepts `name`, `size`, and `color` props
- The wrapper component uses NativeWind className for color — never hardcoded hex
- Never import `MaterialCommunityIcons` directly in a feature component — always go
  through `Icon`
- Icon + label pairs must have `accessibilityLabel` on the parent pressable, not the icon

---

## Acceptance Criteria (all items)

Before marking this sprint done, verify every point:

- [ ] History screen shows completed sessions immediately after finishing a workout
- [ ] History screen shows sessions correctly after a full app reload (kill + reopen)
- [ ] Logging a set requires and saves both weight (kg) and reps
- [ ] Set chips display `{weight} kg × {reps} reps` in mono font
- [ ] History detail view displays weight and reps for each set
- [ ] Old sessions without `weightKg` do not crash the app (default to 0)
- [ ] Weekly schedule screen is reachable from the splits tab
- [ ] Assigning a split to a day persists after app reload
- [ ] Home screen shows today's assigned split (or rest day) at the top
- [ ] "Start Today's Workout" button launches the correct split
- [ ] Week pill row is visible and scrollable on the home screen
- [ ] All icons from the icon map are implemented and correctly sized
- [ ] No `MaterialCommunityIcons` imports outside `src/shared/components/Icon.tsx`
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No inline `style={{}}` props anywhere — NativeWind classNames only
- [ ] No colors outside the custom token palette
