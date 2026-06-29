# Grynd Orchestrator (Squad CLI)

Multi-agent workflow built on the `.squad/` convention and the Cursor SDK.

## Flow (Standard ceremony)

```
Coordinator (TicketMan)
    → Dev (Implementer)
    → Gates (typecheck + lint + test)
    → 3-pass Review (different models)
    → DecisionLog + Traceability + Commit
```

| Squad role | CLI agent | Model (from `.squad/config.json`) |
|---|---|---|
| Coordinator | TicketMan | `models.coordinator` |
| Dev | Implementer | `models.dev` |
| Lead | Review pass 1 & 3 | `reviewModelOverrides.pass1_codeQuality`, `pass3_security` |
| Tester | Review pass 2 | `reviewModelOverrides.pass2_tests` |
| Scribe | DecisionLog | `models.lead` |

## Usage

From the repo root:

```bash
npm run orchestrate -- "Describe the change you want"
```

### Queue runner

Add tasks to `queue.txt` (one per line), then:

```bash
npm run orchestrate:drain
```

Failed tasks are **re-queued at the front** automatically. Ctrl+C re-queues the in-flight task. Failures are also logged to `tools/orchestrator/failed.txt`.

### Environment

| Variable | Required | Default |
|---|---|---|
| `CURSOR_API_KEY` | Yes | — |
| `ORCH_MODEL` | No | Uses per-role models from `.squad/config.json` |
| `ORCH_MAX_ITERS` | No | `3` (from config) |

## Artifacts

Each run writes to `tickets/<timestamp>/`:

- `ticket.md` — scoped spec
- `implementer-<n>.md` — implementation summary
- `gates-<n>.txt` — typecheck/lint/test output
- `diff-<n>.patch` — git diff
- `review-<n>-pass*.md` — 3-pass review reports
- `FINAL.md` — combined passing review
- `decision-log.md` — DecisionLog summary

Traceability appends to `.squad/traceability/stories/<slug>.md`.

## Testing

Orchestrator utilities have unit tests:

```bash
npm run test
```

## Squad docs

- `.squad/charter.md` — mission
- `.squad/ceremonies.md` — gates and response modes
- `.squad/skills/code-review/SKILL.md` — review procedure
- `.squad/skills/testing/SKILL.md` — test review procedure

## Source layout

```
tools/orchestrator/
├── orchestrate.mjs          # Entry (delegates to tsx)
├── src/
│   ├── orchestrate.ts       # Main workflow
│   ├── config.ts            # Loads .squad/config.json
│   ├── gates.ts             # Quality gate runner
│   ├── verdict.ts           # PASS/FAIL parsing
│   ├── ticketUtils.ts       # Path/title extraction
│   ├── traceability.ts      # Story file appends
│   ├── agents/              # Prompt builders
│   └── __tests__/           # Vitest unit tests
└── history.md               # DecisionLog target
```
