# Fix LogSheet bottom anchoring and multiline notes visibility
## Run 2026-06-29T02:07:52.723Z

Artifacts: `tickets/20260628-220455`

### Ticket
## Title

Fix LogSheet bottom anchoring and multiline notes visibility

## Context

The workout **Log Set** flow uses `LogSheet` (`src/features/workout/components/LogSheet.tsx`), a `@gorhom/bottom-sheet` modal rendered from `app/workout/[splitId].tsx`. Recent keyboard-avoidance work added scroll helpers and `keyboardBehavior="interactive"`, but two UX issues remain:

1. **Sheet position** — The sheet does not stay visually anchored to the bottom of the screen when the keyboard is closed; it can appear to float or sit too high.
2. **Notes field** — The optional multiline notes input (`BottomSheetTextInput`, max 200 chars) clips after ~2 lines. Typed text beyond that is not visible while editing, even though the value is stored.

There is in-progress local work on this file (dynamic notes height, `bottomInset={0}`, scroll-to-end on keyboard). This ticket scopes the fix so the sheet rests on the bottom until the keyboard pushes it up, and notes remain fully visible while typing.

## Goal

When logging a set, the LogSheet should sit flush at the bottom of the screen by default and only shift upward when the keyboard is open for an input field. The notes field should grow with content and stay scrollable/visible so the user can read and edit all lines (up to the 200-character limit) without clipping.

## Non-goals

- Changing LogSheet snap height percentage, visual styling, or form fields (weight/reps/plates/RPE).
- Refactoring `useWorkout` or parent screen layout beyond props needed for keyboard/sheet behavior.
- Adding new dependencies.
- Changing notes character limit or persistence logic.
- Fixing unrelated bottom sheets (`ExerciseOverviewSheet`, `SubstituteExerciseSheet`).

## Requirements

1. **Default bottom anchoring**
   - With keyboard closed and no input focused, the LogSheet bottom edge aligns with the device bottom (respecting safe area via bottom inset where appropriate).
   - The sheet must not float above the bottom when idle.

2. **Keyboard-driven lift only**
   - When the user focuses weight, reps, RPE, or notes and the keyboard appears, the sheet moves up so the focused field and primary actions (e.g. **Log Set**) remain usable.
   - When the keyboard dismisses, the sheet returns to bottom-anchored position without leaving stale offset or scroll state.

3. **Multiline notes visibility**
   - Notes input grows vertically as the user types additional lines (no hard ~2-line clip).
   - While notes are focused, newly typed lines stay visible (parent `BottomSheetScrollView` scrolls as content height changes).
   - Notes remain readable when the keyboard is open (scroll/end-padding accounts for keyboard height).
   - Preserve `maxLength={200}` and existing placeholder/label copy.

4. **Regression safety**
   - Existing behaviors remain: pan-to-close, backdrop dismiss, confirm validation, plate mode, no auto-focus on open.
   - Reset scroll/notes height state when the sheet closes.

## Acceptance criteria

- [ ] With keyboard closed, LogSheet is bottom-anchored (no visible gap above the home indicator / screen bottom beyond safe-area inset).
- [ ] Focusing weight, reps, RPE, or notes lifts the sheet above the keyboard; dismissing the keyboard restores bottom anchoring.
- [ ] Typing 4+ lines of notes shows all entered text while focused (no clipping at ~2 lines).
- [ ] Scrolling while notes are focused keeps the caret / latest lines visible as content grows.
- [ ] Closing and reopening LogSheet resets notes field height and scroll position to defaults.
- [ ] **Log Set** confirm button remains reachable when any input field is focused (with keyboard open).
- [ ] Behavior verified on iOS simulator/device; spot-check on Android if available.

## Edge cases

- Rapid focus changes between fields (weight → reps → notes) without dismissing keyboard.
- Notes at or near `MAX_SET_NOTES_LENGTH` (200 chars) with many wrapped lines.
- Sheet dismissed via backdrop swipe or pan-down while keyboard is open.
- Devices with large bottom safe area (e.g. iPhone with home indicator) vs. none.
- Android `adjustResize` vs iOS `keyboardWillShow` timing differences.
- Reopening LogSheet with previously entered (but unlogged) notes text in parent state.

## Implementation notes

**Primary file:** `src/features/workout/components/LogSheet.tsx`

Likely changes:

1. **Bottom anchoring**
   - Reconcile `bottomInset` with `useSafeAreaInsets()`: use safe-area bottom inset when keyboard is closed; avoid double-padding when keyboard is open.
   - Review `@gorhom/bottom-sheet` props: `keyboardBehavior`, `keyboardBlurBehavior`, `android_keyboardInputMode`, and `snapPoints={['82%']}` — ensure they do not lift the sheet when keyboard is hidden.
   - Avoid extra `contentPaddingBottom` when keyboard is closed that creates a floating appearance.

2. **Notes growth + scroll**
   - Keep dynamic height via `onContentSizeChange` and state (e.g. `notesInputHeight`); do not reintroduce a low `maxHeight` cap (previous `NOTES_MAX_HEIGHT = 120` caused ~2-line clipping).
   - Prefer growing the `BottomSheetTextInput` with `scrollEnabled={false}` and let `BottomSheetScrollView` scroll; call scroll-into-view on content size change and text change while notes are focused.
   - Tune `scrollNotesIntoView` / `scrollFieldIntoView` and keyboard-height-driven padding so `scrollToEnd` or computed offset keeps the notes bottom and **Log Set** button in view.
   - Consolidate keyboard listeners and the `focusedField` effect so all fields get consistent avoidance (not only reps/notes).

3. **Cleanup on dismiss**
   - Extend `resetSheetScrollState` (or equivalent) to reset `notesInputHeight`, `notesContentHeight`, `focusedField`, `keyboardHeight`, and scroll offset when sheet index `< 0`.

**Verify only (no changes unless required):**

- `app/workout/[splitId].tsx` — confirm no wrapper styles offset the modal.
- `src/features/workout/hooks/useWorkout.ts` — confirm `present()` / `dismiss()` usage unchanged.

Reference: [@gorhom/bottom-sheet keyboard handling](https://gorhom.dev/react-native-bottom-sheet/keyboard-handling) and Expo SDK 54 keyboard APIs.

## Test plan

**Automated gates (must pass):**

```bash
npm run typecheck
npm run lint
npm run test
```

(UI-only change; no new unit tests required per testing skill unless extracting pure scroll/height helpers.)

**Manual — bottom anchoring**

1. Start a workout → tap **+ Set** to open LogSheet.
2. Confirm sheet bottom aligns with screen bottom (keyboard closed).
3. Focus weight → confirm sheet lifts with keyboard; dismiss keyboard → sheet returns to bottom.
4. Repeat for reps and RPE.

**Manual — notes visibility**

1. Open LogSheet → focus **Notes**.
2. Type 4–6 lines (or enough to wrap past two visible lines).
3. Confirm all lines remain visible while typing; scroll if needed shows full content.
4. Dismiss keyboard → notes text still fully readable in the field.
5. Close sheet, reopen → notes height/scroll reset; enter notes again and confirm no regression.

**Manual — confirm action**

1. With notes focused and keyboard open, confirm **Log Set** is visible or reachable via scroll without hiding the active line being edited.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — Diff is confined to `src/features/workout/components/LogSheet.tsx`. No unrelated files, no new dependencies, no parent/hook changes. Matches ticket non-goals.
- **Ticket alignment — bottom anchoring** — `bottomInset={0}` replaces `bottomInset={insets.bottom}` from f49593a. Safe area is still applied via `contentPaddingBottom` (`Math.max(insets.bottom, 24)`), which matches the ticket’s “reconcile bottomInset / avoid double-padding” guidance. Intentional deviation from sibling sheets (`ExerciseOverviewSheet`, `SubstituteExerciseSheet` still use `insets.bottom`).
- **Ticket alignment — notes visibility** — Removes `NOTES_MAX_HEIGHT = 120` (root cause of ~2-line clipping). Adds `notesInputHeight` state driven by `onContentSizeChange`, `scrollEnabled={false}`, and parent-scroll helpers — directly addresses requirements 2–3.
- **Ticket alignment — keyboard avoidance** — `contentPaddingBottom` now applies for any focused field when the keyboard is open (not only notes/RPE). Separate reps/notes keyboard effects are consolidated into one `scrollFieldIntoView(focusedField)` effect — minimal, scoped consolidation.
- **Cleanup on dismiss** — `resetSheetScrollState` resets focus, keyboard height, notes height ref/state, and scroll offset on sheet close; replaces the narrower `handleKeyboardHide()` call in `handleSheetChange`. Correctly stops resetting notes height on keyboard hide (notes should stay expanded while sheet is open).
- **Regression guard (f49593a)** — Does not revert interactive keyboard behavior, content-size tracking, or focused-field state. Refines the same fix: removes the height cap that caused clipping and adjusts anchoring/padding. No undo of unrelated commits in the guard list.
- **Minimal diff** — ~70 lines changed in one file; no full rewrite. New helpers (`handleNotesChange`, `resetSheetScrollState`, `CONFIRM_BUTTON_HEIGHT`) are small and localized.
- **AGENTS.md / patterns** — NativeWind `className`, inline `style` where needed (existing convention), `@gorhom/bottom-sheet` APIs, `useSafeAreaInsets`, TypeScript strict (no `any`). Naming matches surrounding callbacks/refs.
- **Automated gates** — `npm run typecheck`, `lint`, and `test` all pass (per provided output).
- **Minor observations (non-blocking)** — Magic numbers (`280`, `0.35`, `32`) follow the same heuristic style as existing scroll helpers; `scrollToEnd` when keyboard is open is a simplification that may need manual spot-check on weight/RPE focus but is within ticket scope.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Checked `.squad/skills/testing/SKILL.md`: UI-only ACs may pass with static diff evidence and green gates; manual device checks can be deferred.
- Supplied `LogSheet` diff addresses bottom anchoring with `bottomInset={0}` while retaining safe-area content padding.
- Keyboard handling remains enabled via `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"`, and `adjustResize`; scrolling now applies consistently for focused fields.
- Notes input removes the `120` max-height cap, grows from content size, disables inner scrolling, and scrolls the parent while focused.
- Close/reset path clears focused field, keyboard height, notes height, and scroll position.
- Regression guard: pan-to-close, backdrop dismiss, validation, plate mode, no autofocus, max notes length, placeholder/label copy are preserved in the diff.
- Automated gates passed: `npm run typecheck`, `npm run lint`, and `npm run test` with 21 tests passing.
- Manual iOS/Android visual checks are deferred to manual QA per testing skill; no new unit tests required for this UI-only change.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **Secrets / credentials**: No hardcoded secrets, API keys, tokens, or credentials introduced or touched by this diff.
- **Input validation — notes field**: `maxLength={200}` is preserved on `BottomSheetTextInput`; `MAX_SET_NOTES_LENGTH = 200` constant is unchanged. Client-side length constraint intact.
- **Input validation — numeric fields**: `parseInt(repInput, 10)` retains an explicit radix; no new numeric parsing added without a radix.
- **Notes text flow**: `handleNotesChange` forwards text to `onChangeNotes` (a prop callback) without mutation, stripping, or injection. Validation responsibility is correctly delegated upstream — acceptable pattern for a presentational component.
- **`notesInputHeight` / `keyboardHeight` state**: Both values are derived exclusively from system events (`onContentSizeChange`, keyboard show/hide listeners), not from raw user string input, so there is no state-injection or prototype-pollution vector.
- **AsyncStorage**: No AsyncStorage reads, writes, or removals appear anywhere in this diff. No change to persistence paths.
- **Unsafe JS patterns**: No `eval`, `Function()`, `dangerouslySetInnerHTML`, dynamic `require`, or `setTimeout`/`setInterval` with string payloads. Nested `requestAnimationFrame` calls are timing helpers only.
- **Network / exfiltration**: No fetch, axios, or socket calls introduced.
- **Regression guard**: The diff implements the fix described in commit `f49593a` (bottom anchoring + multiline notes visibility); it does not undo any behaviour from the listed commits. All automated gates (typecheck, lint, 21 tests) pass.
## Run 2026-06-29T02:20:09.135Z

Artifacts: `tickets/20260628-221810`

### Ticket
## Title

Fix LogSheet bottom anchoring and multiline notes visibility

## Context

The workout **Log Set** flow uses `LogSheet` (`src/features/workout/components/LogSheet.tsx`), a `@gorhom/bottom-sheet` modal rendered from `app/workout/[splitId].tsx`. Prior keyboard-avoidance work added scroll helpers, `keyboardBehavior="interactive"`, and notes `onContentSizeChange` tracking, but two UX issues remain in production:

1. **Sheet position** — With the keyboard closed, the sheet does not stay visually anchored to the bottom of the screen; it can appear to float or sit too high (likely from `bottomInset={insets.bottom}` combined with large `contentPaddingBottom` when keyboard is hidden).
2. **Notes field** — The optional multiline notes input (`BottomSheetTextInput`, max 200 chars) is capped at `NOTES_MAX_HEIGHT = 120` (~2 lines). Typed text beyond that is not visible while editing, even though the value is stored.

## Goal

When logging a set, the LogSheet should sit flush at the bottom of the screen by default and only shift upward when the keyboard is open for an input field. The notes field should grow with content and stay scrollable/visible so the user can read and edit all lines (up to the 200-character limit) without clipping.

## Non-goals

- Changing LogSheet snap height percentage (`82%`), visual styling, or form fields (weight/reps/plates/RPE).
- Refactoring `useWorkout` or parent screen layout beyond props needed for keyboard/sheet behavior.
- Adding new dependencies.
- Changing notes character limit or persistence logic.
- Fixing unrelated bottom sheets (`ExerciseOverviewSheet`, `SubstituteExerciseSheet`).

## Requirements

1. **Default bottom anchoring**
   - With keyboard closed and no input focused, the LogSheet bottom edge aligns with the device bottom (respecting safe area via content padding, not double-counted inset).
   - The sheet must not float above the bottom when idle.

2. **Keyboard-driven lift only**
   - When the user focuses weight, reps, RPE, or notes and the keyboard appears, the sheet moves up so the focused field and primary actions (e.g. **Log Set**) remain usable.
   - When the keyboard dismisses, the sheet returns to bottom-anchored position without leaving stale offset or scroll state.

3. **Multiline notes visibility**
   - Notes input grows vertically as the user types additional lines (remove the ~2-line clip caused by `NOTES_MAX_HEIGHT = 120`).
   - While notes are focused, newly typed lines stay visible (`BottomSheetScrollView` scrolls as content height changes).
   - Notes remain readable when the keyboard is open (scroll/end-padding accounts for keyboard height).
   - Preserve `maxLength={200}` and existing placeholder/label copy.

4. **Regression safety**
   - Existing behaviors remain: pan-to-close, backdrop dismiss, confirm validation, plate mode, no auto-focus on open.
   - Reset scroll and notes height state when the sheet closes (not when the keyboard alone dismisses while the sheet stays open).

## Acceptance criteria

- [ ] With keyboard closed, LogSheet is bottom-anchored (no visible gap above the home indicator / screen bottom beyond safe-area inset).
- [ ] Focusing weight, reps, RPE, or notes lifts the sheet above the keyboard; dismissing the keyboard restores bottom anchoring.
- [ ] Typing 4+ lines of notes shows all entered text while focused (no clipping at ~2 lines).
- [ ] Scrolling while notes are focused keeps the caret / latest lines visible as content grows.
- [ ] Closing and reopening LogSheet resets notes field height and scroll position to defaults.
- [ ] **Log Set** confirm button remains reachable when any input field is focused (with keyboard open).
- [ ] Behavior verified on iOS simulator/device; spot-check on Android if available.

## Edge cases

- Rapid focus changes between fields (weight → reps → notes) without dismissing keyboard.
- Notes at or near `MAX_SET_NOTES_LENGTH` (200 chars) with many wrapped lines.
- Sheet dismissed via backdrop swipe or pan-down while keyboard is open.
- Devices with large bottom safe area (e.g. iPhone with home indicator) vs. none.
- Android `adjustResize` vs iOS `keyboardWillShow` timing differences.
- Reopening LogSheet with previously entered (but unlogged) notes text in parent state.
- Keyboard dismissed while sheet remains open — notes field should retain expanded height until sheet closes.

## Implementation notes

**Primary file:** `src/features/workout/components/LogSheet.tsx`

Likely changes:

1. **Bottom anchoring**
   - Reconcile `bottomInset` with `useSafeAreaInsets()`: set `bottomInset={0}` on `BottomSheetModal` and apply safe-area bottom padding only in `contentContainerStyle` (`contentPaddingBottom`) to avoid double-padding that lifts the sheet when the keyboard is hidden.
   - Review `@gorhom/bottom-sheet` props: `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"`, `android_keyboardInputMode="adjustResize"`, and `snapPoints={['82%']}` — ensure they do not lift the sheet when the keyboard is hidden.
   - Avoid extra `contentPaddingBottom` when the keyboard is closed that creates a floating appearance.

2. **Notes growth + scroll**
   - Remove `NOTES_MAX_HEIGHT = 120` and the `maxHeight` style on the notes `BottomSheetTextInput` (root cause of ~2-line clipping).
   - Drive notes height from `onContentSizeChange` via state (e.g. `notesInputHeight`); keep `minHeight: NOTES_MIN_HEIGHT`.
   - Set `scrollEnabled={false}` on the notes input and let `BottomSheetScrollView` handle scrolling; call `scrollNotesIntoView` on content size change and text change while notes are focused.
   - Extend keyboard-driven `contentPaddingBottom` to all focused fields (not only notes/RPE) so weight/reps get consistent avoidance.
   - Do not reset `notesContentHeight` / notes height state in `handleKeyboardHide` — only reset on sheet close (`handleSheetChange` when index `< 0`).

3. **Cleanup on dismiss**
   - Add or extend a `resetSheetScrollState` helper that clears `focusedField`, `keyboardHeight`, notes height ref/state, and scroll offset when the sheet closes.

**Verify only (no changes unless required):**

- `app/workout/[splitId].tsx` — confirm no wrapper styles offset the modal.
- `src/features/workout/hooks/useWorkout.ts` — confirm `present()` / `dismiss()` usage unchanged.

Reference: [@gorhom/bottom-sheet keyboard handling](https://gorhom.dev/react-native-bottom-sheet/keyboard-handling) and Expo SDK 54 keyboard APIs.

## Test plan

**Automated gates (must pass):**

```bash
npm run typecheck
npm run lint
npm run test
```

(UI-only change; no new unit tests required per testing skill unless extracting pure scroll/height helpers.)

**Manual — bottom anchoring**

1. Start a workout → tap **+ Set** to open LogSheet.
2. Confirm sheet bottom aligns with screen bottom (keyboard closed).
3. Focus weight → confirm sheet lifts with keyboard; dismiss keyboard → sheet returns to bottom.
4. Repeat for reps and RPE.

**Manual — notes visibility**

1. Open LogSheet → focus **Notes**.
2. Type 4–6 lines (or enough to wrap past two visible lines).
3. Confirm all lines remain visible while typing; scroll if needed shows full content.
4. Dismiss keyboard → notes text still fully readable in the field.
5. Close sheet, reopen → notes height/scroll reset; enter notes again and confirm no regression.

**Manual — confirm action**

1. With notes focused and keyboard open, confirm **Log Set** is visible or reachable via scroll without hiding the active line being edited.

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope** — Only `src/features/workout/components/LogSheet.tsx` is changed. No new dependencies, no parent-screen or hook refactors. Matches the ticket and non-goals.
- **Bottom anchoring** — `bottomInset={0}` removes double-counting with `contentPaddingBottom` (`Math.max(insets.bottom, 40)`). Safe area stays in content padding only, as specified.
- **Keyboard-driven lift** — `contentPaddingBottom` now applies when any field is focused (`focusedField !== null`), covering weight/reps as well as RPE/notes. Existing `keyboardBehavior="interactive"`, listeners, and scroll helpers are unchanged.
- **Multiline notes** — `NOTES_MAX_HEIGHT` and `maxHeight` are removed. Height is driven by `onContentSizeChange` via `notesInputHeight`; `scrollEnabled={false}` delegates scrolling to `BottomSheetScrollView`. `maxLength={200}` and copy are preserved.
- **Cleanup semantics** — `resetSheetScrollState` runs on sheet close only (`handleSheetChange` when `index < 0`), resetting focus, keyboard height, notes height, and scroll. `handleKeyboardHide` no longer resets notes height, matching the edge case: keyboard dismisses while the sheet stays open.
- **Regression guard** — Builds on commit `f49593a` (keyboard/scroll infrastructure) without reverting it. `bottomInset={0}` and unbounded notes height address remaining gaps from that pass; they do not undo orchestrator, queue, or prior LogSheet keyboard work.
- **Patterns / AGENTS.md** — Feature-local component, NativeWind `className`, inline styles only where needed, strict TypeScript, no `any`, no store or routing changes.
- **Minimal diff** — ~25 lines of focused edits: one constant removed, one state added, two small callbacks adjusted, three prop/style tweaks. No full-file rewrite.
- **Quality gates** — `npm run typecheck`, `npm run lint`, and `npm run test` all pass (21 tests).

**Minor observation (non-blocking):** `notesContentHeight` ref and `notesInputHeight` state duplicate the same value — ref for scroll math, state for layout. Redundant but consistent with existing ref-based offset tracking in this file.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; 21 Vitest tests passed.
- Default anchoring has static evidence: `bottomInset={0}` removes safe-area double counting, while safe-area padding remains in scroll content.
- Keyboard avoidance has static evidence for all focused fields via `focusedField !== null`, with existing bottom-sheet keyboard props preserved.
- Notes clipping is addressed: `NOTES_MAX_HEIGHT` and `maxHeight` were removed, height now follows content size, and scrolling is delegated to `BottomSheetScrollView`.
- Close/reset behavior has static evidence: notes height, keyboard state, focused field, and scroll position reset only when the sheet closes.
- Regression guard passed: pan-down close, backdrop dismiss, confirm validation, plate mode, `maxLength={200}`, and no auto-focus behavior are preserved in the diff.
- No new pure utility functions were added, so no new unit tests are required for this UI-only change.
- Manual simulator/device ACs for visual anchoring, keyboard movement, tap reachability, and Android spot-check are deferred to manual QA per CLI orchestrator rules.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets** — Diff is confined to `LogSheet.tsx`. No `.env` values, API keys, tokens, or credentials anywhere in the changed lines.
- **AsyncStorage** — This component has no AsyncStorage interaction; all state is received via props and held in React state/refs. Not applicable to this diff.
- **User input sanitized where persisted**
  - `notesInput`: `maxLength={200}` enforced at the `BottomSheetTextInput` level (unchanged, still present at line 491). Text beyond the limit is rejected by the native layer before `onChangeText` fires.
  - `repInput`: `maxLength={3}` enforced on the reps `NumericInput` (unchanged).
  - `rpeInput`: inline clamping (`Math.min(10, Math.max(1, num))`) present and unchanged.
  - `weightInput`: numeric keyboard (`keyboardType="number-pad"`) restricts entry to digits at the OS level; unchanged from pre-diff.
  - `notesInputHeight` is derived from `event.nativeEvent.contentSize.height` (a trusted native value) with a `Math.max(NOTES_MIN_HEIGHT, height)` floor — no unbounded growth vector, and 200-char cap makes the practical maximum height trivially small.
- **No unsafe patterns** — No `eval`, dynamic `require`, shell invocations, or `dangerouslySetInnerHTML` equivalents.
- **File paths** — No document picker or user-supplied file path handling in this component.
- **Regression guard** — Changes align precisely with commits `78aeb5b` and `f49593a` (LogSheet bottom anchoring + multiline notes). `resetSheetScrollState` replaces `handleKeyboardHide` only in the sheet-close path, preserving the keyboard-dismiss-only path intact. `bottomInset={0}` + safe-area padding in `contentContainerStyle` is the documented fix for the double-inset issue. No described prior behavior is removed.
