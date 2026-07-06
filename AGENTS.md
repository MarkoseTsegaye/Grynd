# Grynd — Agent Instructions

## Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 + React Native 0.81 |
| Navigation | Expo Router v6 (`app/`) |
| Styling | NativeWind v4 (Tailwind) |
| State | Zustand v5 |
| Animations | React Native Reanimated v4 |
| Language | TypeScript 5.9 |

**Always read Expo v54 docs before writing platform code:** https://docs.expo.dev/versions/v54.0.0/

## Orchestration

This project uses a `.squad/` multi-agent convention. Read:

- `.squad/charter.md` — mission and agreements
- `.squad/team.md` — agent roster
- `.squad/ceremonies.md` — gates and response modes

CLI orchestrator: `npm run orchestrate -- "your request"` (requires `CURSOR_API_KEY`).

## Quality gates

Run before claiming work is done:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src/ app/
npm run test        # vitest (orchestrator + shared lib tests)
```

## File conventions

| Area | Path | Notes |
|---|---|---|
| Screens | `app/` | Expo Router file-based routing |
| Features | `src/features/<name>/` | components, hooks, store, types |
| Shared UI | `src/shared/components/` | Button, Badge, ScreenHeader, etc. |
| Theme | `src/shared/theme/` | colors, typography |
| Storage | `src/storage/adapters/` | AsyncStorage persistence |
| Backup | `src/storage/backup/` | export/import/validate |

## Patterns

- **State:** Zustand stores in `src/features/*/store/`. Persist via storage adapters, not raw AsyncStorage in components.
- **Styling:** `className` via NativeWind on most screens. Tab bar and some legacy areas use inline `style` + `src/shared/theme/colors.ts`.
- **Headers:** Tab roots use `ScreenHeader`. Stack-pushed screens use `stackHeaderOptions` in `app/_layout.tsx`.
- **Haptics:** `useHaptics()` — `light`, `medium`, `heavy`, `success`.
- **IDs:** `src/shared/lib/id.ts` for UUID generation.

## Anti-patterns

- Do not touch `.env`, `.env.*`, or credential files.
- Do not rewrite entire files for small fixes.
- Do not add dependencies without justification.
- Do not use outdated Expo APIs — check v54 docs.
- Do not skip tests for new pure functions or store logic.

## Commit style

- Feature: `feat: description`
- Fix: `fix: description`
- Orchestrator auto-commits: `[orchestrator] <ticket title>`
