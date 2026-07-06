# Grynd Ceremonies

## Response Mode Selection

The Coordinator picks a mode before scoping work:

| Mode | When | Ceremony |
|---|---|---|
| **Direct** | Typo, one-liner, config tweak | Dev implements; skip ticket if trivial |
| **Lightweight** | Single-file bug fix, < 3 AC items | TicketMan → Dev → gates → 1 review pass |
| **Standard** | Feature or multi-file change | Full ticket → Dev → gates → 3-pass review |
| **Full** | Architecture, new feature area, breaking change | Ticket + Lead plan review → Dev → gates → 3-pass review → DecisionLog |

CLI default: **Standard** (always tickets + 3-pass review).

## Implementation Gate

Before review, all commands in `.squad/config.json → gates` must exit 0:

- `npm run typecheck`
- `npm run lint`
- `npm run test`

## Code Review Gate (3-pass)

Three reviewers, **different models**, same diff:

| Pass | Focus | Model key | Skill |
|---|---|---|---|
| 1 | Code quality, patterns, scope creep | `pass1_codeQuality` | `.squad/skills/code-review/SKILL.md` |
| 2 | Tests, AC coverage, regressions | `pass2_tests` | `.squad/skills/testing/SKILL.md` |
| 3 | Security, data handling, edge cases | `pass3_security` | `.squad/skills/code-review/SKILL.md` |

**PASS** requires: all gates green + all 3 review passes say `PASS`.

## Completion Gate

On PASS:

1. Write final review to `tickets/<run>/FINAL.md`
2. Append traceability entry to `.squad/traceability/stories/<story>.md`
3. Run DecisionLog → update `tools/orchestrator/history.md` and `.squad/decisions.md`
4. Commit with `[orchestrator] <title>`

## Failure handling

- Any review pass `FAIL` → feed report to Implementer, retry (up to `ORCH_MAX_ITERS`)
- Gates fail → retry without new review until gates pass or max iters
