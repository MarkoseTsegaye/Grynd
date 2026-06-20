# Grynd Squad Charter

## Mission

Ship reliable, well-tested changes to the Grynd Expo/React Native workout app. Every story passes quality gates before merge.

## Working agreements

1. **Small diffs** — surgical changes only; no drive-by refactors.
2. **Expo v54 docs** — read https://docs.expo.dev/versions/v54.0.0/ before writing platform code.
3. **Gates are mandatory** — `npm run typecheck`, `npm run lint`, and `npm run test` must pass.
4. **Traceability** — append to the story file under `.squad/traceability/stories/`; never rewrite history.
5. **Decisions** — durable choices go in `.squad/decisions.md` (append-only).
6. **Secrets** — never touch `.env`, credentials, or API keys.

## Repo map

| Area | Path |
|---|---|
| Screens (Expo Router) | `app/` |
| Shared logic/components | `src/` |
| State (Zustand) | `src/features/*/store/` |
| Persistence | `src/storage/adapters/` |
| Orchestrator CLI | `tools/orchestrator/` |
| Squad config | `.squad/` |

## Activation

Each AI session should read, in order:

1. `AGENTS.md` — stack, lint, patterns
2. `.squad/charter.md` — this file
3. `.squad/team.md` — who does what
4. `.squad/ceremonies.md` — gates and response modes

Then act per the user's request and route through the Coordinator.
