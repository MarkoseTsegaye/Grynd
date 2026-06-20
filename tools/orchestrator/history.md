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

### Workout log sheet

- **`present()` timing:** defer `BottomSheetModal.present()` one frame via `requestAnimationFrame`; effect cleanup cancels pending rAF and focus timer.

### Haptics API

- **`useHaptics`** exposes `medium`, `heavy`, `light`, `success`. `impact` is a backward-compat alias for `medium`.

### Orchestrator

- **Squad convention:** `.squad/` defines agents, ceremonies, and skills; CLI in `tools/orchestrator/` implements Standard ceremony.
- **Flow:** TicketMan → Implementer → gates (typecheck, lint, test) → 3-pass review (different models) → DecisionLog → traceability → commit.
- **CLI entry:** `orchestrate.mjs` delegates to `tsx tools/orchestrator/src/orchestrate.ts`; agent prompts live under `src/agents/`.
- **3-pass review:** Pass 1 code quality, Pass 2 tests/AC, Pass 3 security — models from `.squad/config.json → reviewModelOverrides`.
- **DecisionLog runs only after PASS** to keep this file current; capture durable decisions, not ticket/diff noise.
- **Reviewer stop conditions:** all 3 passes PASS + green gates → success + DecisionLog + traceability; any FAIL → retry until `ORCH_MAX_ITERS`.
