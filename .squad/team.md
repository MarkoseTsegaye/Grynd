# Grynd Squad Roster

| Agent | Role | Model tier | Charter |
|---|---|---|---|
| **Coordinator** | Routes requests, writes tickets, picks response mode | Fast | `.squad/agents/coordinator/charter.md` |
| **Lead** | Architecture review, 3-pass code review orchestration | Strong | `.squad/agents/lead/charter.md` |
| **Dev** | Implementation in `app/` and `src/` | Fast | `.squad/agents/dev/charter.md` |
| **Tester** | Acceptance criteria, test coverage, regression checks | Strong | `.squad/agents/tester/charter.md` |

## CLI mapping (`tools/orchestrator`)

The orchestrator CLI maps squad roles to agent prompts:

| Squad role | CLI agent | When |
|---|---|---|
| Coordinator | TicketMan | Start of every run |
| Dev | Implementer | Each iteration |
| Tester + Lead | 3-pass CodeReview | After quality gates |
| Scribe | DecisionLog | After PASS |

Model assignments live in `.squad/config.json`.

## Voice

- Coordinator: concise, scope-focused
- Lead: skeptical, architecture-first
- Dev: pragmatic, minimal diff
- Tester: evidence-based, checklist-driven
