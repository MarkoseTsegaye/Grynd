## Title
Center and unify screen header spacing and typography

## Context
Grynd uses two header patterns today:

1. **Tab screens** (`app/(tabs)/index.tsx`, `splits.tsx`, `history.tsx`) render custom in-screen titles with duplicated markup: left-aligned `text-4xl font-sans-bold`, `px-5 pt-14 pb-4`.
2. **Stack screens** use React Navigation headers configured in `app/_layout.tsx` (`headerStyle`, `headerTintColor`, static `headerTitle`) while some screens also render a second in-screen title (`app/cycle.tsx`, `app/splits/[splitId].tsx`).

Spacing and alignment are inconsistent across screens (`pt-14` on tabs vs `pt-4` on stack detail screens; left-aligned titles vs navigation bar defaults). There is no shared header component, and design tokens in `src/shared/theme/typography.ts` are not used for screen titles.

## Goal
Introduce a single, reusable screen header pattern that centers titles, applies consistent vertical spacing (safe-area aware), and uses unified typography—across all primary screens without changing screen behavior or navigation structure.

## Non-goals
- Redesigning tab bar, cards, bottom sheets, or workout logging UI beyond header/title rows
- Renaming screen copy (e.g., keeping Home tab title “Workouts” as-is unless required for layout)
- Refactoring unrelated layout/spacing in list content, forms, or section labels (“TODAY”, “All Splits”, etc.)
- Adding new dependencies or changing Zustand/storage logic
- Reworking the workout screen’s cancel/progress/finish control row (only the exercise name title block if applicable)

## Requirements
1. Add a shared `ScreenHeader` component under `src/shared/components/` that supports:
   - Required `title: string`
   - Optional `subtitle?: string` (e.g., exercise count, cycle day count)
   - Optional `rightActions?: React.ReactNode` for screens that need header actions (Splits)
   - Safe-area–aware top padding (use `react-native-safe-area-context`, not hard-coded `pt-14`)
   - Centered title typography: `text-text-primary font-sans-bold text-4xl text-center`
   - Consistent horizontal padding matching existing content (`px-5`) and bottom spacing separating header from body (`pb-4` or token equivalent)
2. Replace duplicated header markup in tab screens with `ScreenHeader`:
   - `app/(tabs)/index.tsx` — title: “Workouts”
   - `app/(tabs)/splits.tsx` — title: “Splits”, pass cycle icon + “+ New” as `rightActions`; title remains visually centered (use a balanced 3-zone layout: left spacer / centered title / right actions)
   - `app/(tabs)/history.tsx` — title: “History” (both empty and populated states)
3. Normalize stack screen headers in `app/_layout.tsx`:
   - Set `headerTitleAlign: 'center'` for all `headerShown: true` screens
   - Apply shared stack header styling via `screenOptions` (background `#141414` / `surface-1`, tint `#F0EDE8` / `text-primary`, consistent title font weight/size via `headerTitleStyle`)
   - Keep existing route titles: “Manage Split”, “Session”, “Training Cycle”
4. Remove redundant in-screen page titles where a native stack header already exists:
   - `app/cycle.tsx` — remove duplicate “Training Cycle” `text-4xl` block; keep subtitle (“N days · Repeats indefinitely”) as body content below the nav header with appropriate top padding
   - `app/splits/[splitId].tsx` — remove duplicate large title if it repeats the nav header; show split name as a centered subtitle or section heading styled consistently (not a second `text-4xl` page title)
5. Update `app/splits/[splitId].tsx` and `src/features/history/components/SessionDetail.tsx` in-screen header rows to align with the new centered header style where they act as screen-level headers (split name / session metadata).
6. Optionally extend `src/shared/theme/typography.ts` with screen-header tokens (title size, subtitle size, vertical spacing) and reference them from `ScreenHeader` to avoid magic class strings.
7. Preserve accessibility labels on existing header actions (Splits cycle button, “+ New”, back navigation).

## Acceptance criteria
- [ ] A reusable `ScreenHeader` component exists at `src/shared/components/ScreenHeader.tsx` and is used by all three tab screens
- [ ] Tab screen titles (“Workouts”, “Splits”, “History”) are horizontally centered on iOS and Android
- [ ] Splits screen header actions remain functional and the title does not shift off-center when actions are present
- [ ] Top spacing respects the device safe area on tab screens (no content under the status bar; no excessive gap on devices with smaller insets)
- [ ] Stack screens with native headers (`Manage Split`, `Session`, `Training Cycle`) show centered navigation titles with consistent background/tint/title styling defined in `app/_layout.tsx`
- [ ] `app/cycle.tsx` no longer shows a duplicate “Training Cycle” large title beneath the native header
- [ ] `app/splits/[splitId].tsx` no longer shows a redundant large page title duplicating the native header; split metadata remains readable and centered or consistently aligned per the new pattern
- [ ] Header spacing between title block and first content section is consistent across tab screens (±4px)
- [ ] No regressions to navigation (back button, tab switching, workout modal presentation)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Edge cases
- **Splits header with variable-width actions**: “+ New” toggles to “Cancel”; centered title must stay stable in both states
- **Long split names** on Manage Split: subtitle/split name should truncate (`numberOfLines={1}`) without breaking layout
- **History empty state**: header renders identically to the populated state
- **Small screens / large font accessibility settings**: titles wrap or truncate gracefully without overlapping `rightActions`
- **Android vs iOS safe area**: verify `pt-14` is not blindly copied; use safe-area insets
- **Cycle screen with 0 days**: subtitle hidden today; header/content spacing should still look balanced
- **Session detail**: native header says “Session”; in-content date/split metadata should not look like a second competing page title

## Implementation notes
**New file**
- `src/shared/components/ScreenHeader.tsx` — centered title layout; for action rows, use a root `View` with three children (`flex-1` left placeholder, centered title `View`, `flex-1` right actions aligned end) so the title stays centered regardless of action width

**Update tab screens**
- `app/(tabs)/index.tsx` — replace lines ~68–70 header `View` with `<ScreenHeader title="Workouts" />`
- `app/(tabs)/splits.tsx` — replace lines ~79–98 with `<ScreenHeader title="Splits" rightActions={...} />`
- `app/(tabs)/history.tsx` — replace duplicated header blocks (~46–48 and ~61–63) with `<ScreenHeader title="History" />`

**Update stack layout**
- `app/_layout.tsx` — extract shared stack header options (e.g., `headerTitleAlign: 'center'`, `headerStyle`, `headerTintColor`, `headerTitleStyle`) into a constant applied to `splits/[splitId]`, `history/[sessionId]`, and `cycle` `Stack.Screen` entries

**Update stack detail screens**
- `app/cycle.tsx` — remove the `text-4xl` “Training Cycle” title block (~109–115); adjust top padding on the subtitle/content section
- `app/splits/[splitId].tsx` — replace the `text-4xl` split name block (~54–58) with a centered subtitle pattern using `ScreenHeader` or a lighter centered heading consistent with nav header
- `src/features/history/components/SessionDetail.tsx` — restyle the level-1 header row (~17–25) to centered, consistent metadata presentation under the native “Session” header

**Optional tokens**
- `src/shared/theme/typography.ts` — add `screenTitle`, `screenSubtitle`, `screenHeaderPadding` constants consumed by `ScreenHeader`

**Out of scope unless trivial**
- `src/features/workout/components/ExerciseScreen.tsx` exercise name (`text-4xl` at ~111) — only touch if aligning with centered screen-title style is straightforward without moving the cancel/progress toolbar

## Test plan
1. Run static checks:
   ```bash
   npm run typecheck
   npm run lint
   ```
2. Manual UI verification (iOS Simulator and one Android emulator or device):
   - **Home tab**: “Workouts” centered; comfortable spacing below status bar; scroll content unchanged
   - **Splits tab**: title centered with cycle + “+ New” actions; toggle form open/closed and confirm title stays centered
   - **History tab**: title centered in empty and populated states
   - **Training Cycle** (`/cycle`): native header centered; no duplicate large title; subtitle and list spacing look correct
   - **Manage Split** (`/splits/[id]`): native header centered; split name/metadata readable without duplicate hero title
   - **Session detail** (`/history/[id]`): native “Session” header centered; in-content metadata aligned with new pattern
   - **Workout flow**: open from Home; confirm workout screen header/toolbar still functions (smoke test only)
3. Rotate or test on a notched device (if available) to confirm safe-area padding on tab headers
