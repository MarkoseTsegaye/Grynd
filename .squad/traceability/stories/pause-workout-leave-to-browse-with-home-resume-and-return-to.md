# Pause workout (leave to browse) with Home resume and return-to-workout prompt
## Run 2026-06-29T03:51:55.539Z

Artifacts: `tickets/20260628-234715`

### Ticket
## Title

Pause workout (leave to browse) with Home resume and return-to-workout prompt

## Context

Grynd already persists in-progress workouts via `sessions:active` (`src/storage/adapters/sessions.ts`) and `useWorkoutStore` (`src/features/workout/store/workoutStore.ts`). The workout screen exposes **Leave Workout** in a cancel sheet (`app/workout/[splitId].tsx`), which calls `leaveWorkout()` and navigates to tabs while keeping the session in storage.

Home partially surfaces resume UI when a session exists (`app/(tabs)/index.tsx`): a **PAUSED WORKOUT** card or a **Resume** button inside the Today card. On cold start and foreground return, `useResumeWorkoutPrompt()` (`src/features/workout/hooks/useResumeWorkoutPrompt.ts`, mounted in `app/_layout.tsx`) shows a native **Resume Workout?** alert.

Gaps remain: leaving via hardware back / swipe-back is not gated like **Leave Workout**; Home resume UI is inline and easy to miss when Today logic hides the card; foreground resume relies on in-memory Zustand state without rehydrating from AsyncStorage; and there is no explicit “paused” marker on the session after leave (live workout vs. left-to-browse are indistinguishable in persisted data).

**Response mode:** Standard ceremony (multi-file UX + store/hook hardening).

## Goal

Users can intentionally pause a workout by leaving the workout screen, browse all tab destinations freely, resume from Home, and see the familiar return-to-workout prompt when reopening or refocusing the app—without losing logged sets or exercise index.

## Non-goals

- Persisting or restoring the in-memory rest timer across leave/resume (`useRestTimer.ts`).
- A global paused-workout banner on every tab (Splits, History, Settings).
- Replacing the native **Resume Workout?** alert with a custom modal in this ticket (keep existing alert copy/behavior unless a dismiss leaves no path to resume—Home must cover that).
- Workout conflict handling when starting a different split while one is paused (existing Alert on `app/workout/[splitId].tsx` bootstrap stays as-is).
- Elapsed-time / analytics for pause duration.

## Requirements

1. **Leave = pause:** **Leave Workout** continues to persist session + `currentExerciseIndex` via `leaveWorkout()` and route to `/(tabs)`.
2. **Explicit paused state:** When the user leaves (not while actively on the workout screen), persist a pause marker on the session (e.g. `pausedAt: number`) set in `leaveWorkout()` and cleared when the workout screen is actively entered/resumed or on finish/abandon.
3. **Safe exit paths:** Android hardware back and iOS swipe-back from the workout screen must not silently drop the user into tabs without persisting pause state—either route through the same leave flow or present the existing cancel/leave sheet.
4. **Home resume CTA:** When `session.pausedAt` is set (or equivalent “left to browse” signal), Home shows a prominent **Resume {splitName}** control regardless of Today/cycle split matching. Reuse or extract shared UI rather than duplicating two inline blocks.
5. **Return-to-workout on app return:** After a paused session exists, cold start and foreground (`inactive`/`background` → `active`) must rehydrate from storage (`loadActiveSession()`) before deciding to prompt; show **Resume Workout?** when not already on `/workout/*` (preserve debounce and cold-start guard in `workoutRoute.ts`).
6. **Resume behavior:** Tapping resume (Home or alert) navigates to `/workout/${splitId}` and restores the same session, exercise index, and logged sets without starting a new session.

## Acceptance criteria

- [ ] From an in-progress workout, **Leave Workout** saves progress, sets pause state, and lands the user on tabs; all four tabs are reachable without discarding the session.
- [ ] From an in-progress workout, hardware back / swipe-back triggers the same leave-or-confirm behavior (no orphaned live session without pause marker).
- [ ] When a paused session exists, Home always shows a **Resume {splitName}** button/card (visible for both “today’s split” and “other split” cases).
- [ ] Tapping Home resume opens the correct workout at the saved exercise index with prior sets intact.
- [ ] After leaving a paused workout, force-quitting and reopening the app shows **Resume Workout?** with correct split name; **Resume** opens the workout, **Discard** clears `sessions:active`.
- [ ] After leaving a paused workout, backgrounding the app for ≥3s and returning (without force-quit) shows **Resume Workout?** once (respecting cold-start suppression window).
- [ ] Dismissing the return prompt without choosing leaves the paused session intact; Home resume remains available.
- [ ] Finishing or discarding a workout clears pause state and removes Home resume UI.
- [ ] Store/unit tests cover pause marker set on leave, clear on resume entry/finish/abandon, and foreground rehydrate before prompt.

## Edge cases

- User pauses, dismisses return alert, never opens Home—next foreground should prompt again (session still in storage).
- User pauses workout A, taps Start on split B from Splits—existing conflict Alert still applies; no duplicate sessions.
- `loadActiveSession()` returns null (corrupt/missing storage)—no resume UI, no prompt, no crash.
- User is already on `/workout/[splitId]` when app foregrounds—no resume prompt.
- Cold start + foreground within 2s—only one prompt (existing `COLD_START_GUARD_MS` behavior preserved).
- Session exists but `pausedAt` unset (legacy data pre-migration)—treat as paused if `completedAt === null` and user is not on workout route (backward compatible).

## Implementation notes

**Types & persistence**

- `src/features/workout/types.ts` — add optional `pausedAt?: number` to `WorkoutSession`.
- `src/storage/adapters/sessions.ts` — no key change; new field serializes with existing `ACTIVE_SESSION` payload.

**Store**

- `src/features/workout/store/workoutStore.ts`:
  - `leaveWorkout()` — set `pausedAt: Date.now()` on persisted session.
  - Add `resumeWorkoutEntry()` or clear `pausedAt` when workout screen mounts with matching `splitId` (avoid clearing on unrelated navigation).
  - `finishWorkout()` / `abandonWorkout()` — ensure `pausedAt` cleared with session.
- `src/features/workout/index.ts` — export any new selectors/helpers if added.

**Workout screen & navigation**

- `app/workout/[splitId].tsx`:
  - On successful bootstrap of matching active session, clear pause marker (user is “in” the workout again).
  - Wire `BackHandler` (Android) and `beforeRemove` / stack back interception (Expo Router) to open cancel sheet or call `handleLeaveWorkout` instead of unmounting without pause.
- `src/features/workout/lib/workoutRoute.ts` — extend helpers if needed (e.g. `hasPausedSession(session)`); keep `isWorkoutRoute` / guard helpers.

**Home resume UI**

- New `src/features/workout/components/PausedWorkoutResumeCard.tsx` (or similar) — single resume card/button using theme tokens (`textRoles`, `Icon`, accent button).
- `app/(tabs)/index.tsx` — replace duplicated Today/PAUSED blocks with shared component; show when paused session is present (`pausedAt` or legacy fallback).

**App return prompt**

- `src/features/workout/hooks/useResumeWorkoutPrompt.ts`:
  - On foreground, `await loadActiveSession()` before reading `session`.
  - Prompt when session exists, is incomplete, and user is off workout routes (optionally require `pausedAt` or legacy fallback).
- `app/_layout.tsx` — no structural change expected; hook stays mounted at root.

**Tests**

- `src/features/workout/__tests__/workoutStore.test.ts` — pause marker on leave; cleared on finish/abandon/resume entry.
- `src/features/workout/__tests__/useResumeWorkoutPrompt.test.ts` — add pure helper tests if prompt eligibility moves into `workoutRoute.ts`; mock store rehydrate behavior if hook logic grows.

## Test plan

**Automated (required):**

```bash
npm run typecheck
npm run lint
npm run test
```

**Manual QA:**

1. Start a workout, log a set, tap **Leave Workout** → confirm tabs work; return to Home → **Resume** visible; resume restores set and exercise index.
2. Start a workout, press Android back (or iOS swipe-back) → confirm leave sheet or auto-leave with pause persisted.
3. Pause workout, force-quit app, reopen → **Resume Workout?** appears; test Resume and Discard.
4. Pause workout, background app 5s, return → prompt appears once; dismiss → Home resume still works.
5. Pause workout, finish from resumed session → Home resume disappears.
6. Regression: start today’s split workout, leave, confirm Today card still shows resume (not only the PAUSED WORKOUT card path).

### Final review
# Pass 1 (pass1_codeQuality)

## Verdict

PASS

## Findings

- **Scope:** All touched files map to the ticket (store/types, route helpers, resume hook, Home + workout screens, tests, new `PausedWorkoutResumeCard`). No unrelated deps, config, or drive-by refactors.
- **Minimal diff:** Home resume UI is deduplicated into one shared card (~67 lines removed from `index.tsx`); store/hook changes are small and targeted. No full-file rewrites.
- **AGENTS.md patterns:** Zustand store owns pause state; persistence goes through `setActiveSession`; screens use NativeWind + `textRoles`; new pure helpers and store actions have unit tests; quality gates (`typecheck`, `lint`, `test`) all pass.
- **Ticket alignment:** `leaveWorkout()` sets `pausedAt`; `resumeWorkoutEntry()` clears it on matching workout entry; finish/abandon remove the session; foreground/cold-start prompt rehydrates via `loadActiveSession()` before eligibility checks.
- **Safe exit paths:** `beforeRemove` and Android `BackHandler` both gate back/swipe with the existing cancel sheet; intentional exits set `isLeavingIntentionallyRef` before navigation.
- **Home resume CTA:** `hasPausedSession()` drives a single top-of-scroll `PausedWorkoutResumeCard` for all paused/legacy incomplete sessions, matching req 4 (replacing the old Today vs PAUSED split).
- **Return prompt:** `shouldPromptResumeSession()` centralizes eligibility (incomplete session + off workout route); legacy sessions without `pausedAt` still prompt/show resume UI per edge-case spec.
- **Regression guard:** Prior commit behavior (leave persists session, Home resume, app-return prompt) is preserved and extended—not reverted. Today-card inline resume is intentionally consolidated into the shared card per ticket, not dropped.
- **Minor nits (non-blocking):** `hasPausedSession` is a thin alias for `isIncompleteActiveSession` (name vs behavior); `isIncompleteActiveSession` is exported but only used in tests; `s!` non-null assertions in the hook could be narrowed with a local guard. None affect correctness or scope.

---

# Pass 2 (pass2_tests)

## Verdict
PASS

## Findings
- Automated gates are green: `npm run typecheck`, `npm run lint`, and `npm run test` all exited 0; 6 test files and 53 tests passed.
- AC evidence is present for pause persistence: `leaveWorkout()` now writes `pausedAt` and preserves `currentExerciseIndex`; tests cover the persisted marker.
- AC evidence is present for resume clearing: `resumeWorkoutEntry(splitId)` clears `pausedAt` only for the matching split and is called during workout bootstrap; tests cover match, mismatch, and unpaused no-op.
- AC evidence is present for Home resume: Home uses shared `PausedWorkoutResumeCard` and `hasPausedSession(activeSession)`, making the resume CTA independent of Today split matching.
- AC evidence is present for app-return prompt: prompt eligibility moved into tested helpers, and foreground/cold-start paths call `loadActiveSession()` before checking prompt eligibility.
- AC evidence is present for resume navigation: Home and alert resume route to `/workout/${splitId}`, where existing matching active session bootstrap is reused rather than starting a new session.
- Safe exit paths have static evidence: `beforeRemove` and Android `BackHandler` present the existing cancel/leave sheet instead of silently navigating away. iOS swipe-back and hardware back behavior are deferred to manual QA for device validation.
- No regression found against the listed recent paused-workout commits; the diff preserves leave-to-tabs, Home resume, and return prompt behavior while hardening pause state.
- Manual-only ACs deferred to manual QA: tab reachability on device, iOS swipe gesture behavior, native alert presentation, and visual prominence/tap behavior of the Home CTA.

---

# Pass 3 (pass3_security)

## Verdict

PASS

## Findings

- **No secrets or credentials** — The diff touches only local AsyncStorage keys (`ACTIVE_SESSION`), workout session metadata (IDs, names, timestamps, rep/weight values), and UI state. No API keys, tokens, or PII are introduced or exposed.

- **AsyncStorage read safety** — `getActiveSession()` wraps `JSON.parse(raw) as WorkoutSession` in a `try/catch` that silently returns `null` on any parse failure. The store's `loadActiveSession` also catches and surfaces errors via `set({ error: ... })`. A null result propagates cleanly through `hasPausedSession(null) → false`, meaning no resume UI or prompt appears on corrupted storage. This is consistent with the existing pre-diff pattern and the ticket's edge-case requirement.

- **AsyncStorage write safety** — `setActiveSession` and `clearActiveSession` both throw typed errors on failure (caught by callers). `leaveWorkout` does not wrap its `setActiveSession` call — a write failure here would leave the in-memory state with `pausedAt` set but storage without it. This is a **pre-existing pattern** across all store mutations (`logSet`, `deleteSet`, `substituteExercise`) and is outside this diff's scope; no regression introduced.

- **Non-null assertions after `shouldPromptResumeSession`** — `s!.splitId` / `s!.splitName` appear after `shouldPromptResumeSession(s, ...)` which internally calls `hasPausedSession(s)` → `isIncompleteActiveSession(s)` → `s !== null`. Logically sound; TypeScript cannot narrow through the function boundary but no runtime null-deref can occur on this path. Not a vulnerability.

- **URL/route construction with user-controlled data** — `splitId` (used in `router.push(\`/workout/${splitId}\`)`) originates from `session.splitId` written by the app itself during `startWorkout`. In Expo Router, deep-link handling is a separate concern that exists pre-diff. No new untrusted-input path introduced.

- **`isLeavingIntentionallyRef` gate** — All three exit paths (finish, discard, leave) set the ref to `true` before navigation. The `beforeRemove` and `BackHandler` listeners correctly check this ref, preventing accidental session abandonment without the cancel sheet. The ref is not reset, but component remount on navigation replace makes this a non-issue.

- **`splitName` in Alert/Text** — React Native's `Alert.alert` and `<Text>` components render content as plain text; no script-injection or HTML-injection risk exists on this platform.

- **Devtools middleware scoped to development** — `enabled: process.env.APP_ENV === 'development'` is unchanged; no state leaks in production builds.

- **Race condition in foreground prompt** — `loadActiveSession` is called inside the 300 ms debounce callback. Rapid back-to-back foreground transitions cancel the previous timer before it fires, so only one `loadActiveSession` call executes per foreground event. `alertVisibleRef` provides a second guard against stacked alerts. Safe.

- **`hasPausedSession` treats any incomplete session as paused** — By design (backward-compat with sessions without `pausedAt`). The `isWorkoutRoute` guard prevents prompts while the user is already on the workout screen, so no duplicate prompt can appear. Intentional, documented in ticket edge cases.

- **Regression guard** — Leave → pause → Home resume → return prompt flow is all present and consistent with the described commits. No behaviour described in `b493949`–`bc74ee1` is undone.
