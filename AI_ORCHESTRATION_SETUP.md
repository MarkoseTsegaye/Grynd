# Setting Up AI Orchestration Like This Project

What this project uses is a custom **multi-agent squad system** built on top of plain markdown + a `.squad/` directory. It's not a framework — it's a *convention*. Any AI coding assistant (Copilot, Claude Code, Cursor) that reads files in your repo can participate. Here's how to bootstrap one.

## 1. The Two Layers

| Layer | Purpose | Files |
|---|---|---|
| **Tool layer** | Tells *every* AI session the project's rules (stack, lint, patterns) | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` |
| **Orchestration layer** | Defines *who* does the work, *how* they hand off, *what* gates code passes | `.squad/` directory |

Start with the tool layer first — it pays off even without orchestration.

## 2. Minimum Viable `.squad/`

You don't need all 8 agents. The skeleton:

```
.squad/
├── charter.md              # team mission + working agreements
├── team.md                 # roster + model assignments
├── config.json             # which model each agent uses
├── ceremonies.md           # gates (code review, completion, etc.)
├── decisions.md            # ADR log (append-only)
├── agents/
│   ├── coordinator/charter.md   # the router
│   ├── lead/charter.md          # architecture + code review
│   └── dev/charter.md           # implementation
├── skills/
│   └── code-review/SKILL.md     # reusable procedures
└── traceability/
    └── stories/                  # one .md per story/PR
```

See `.squad/charter.md` for the template structure and `.squad/agents/ripley/` for a real agent example.

## 3. Core Concepts to Copy

**Agents = personalities + boundaries.** Each gets a charter file with: identity, what they own, what they refuse, model tier, and voice. See `.squad/team.md` for the roster pattern.

**Skills = reusable workflows.** When a procedure works, extract it into `.squad/skills/<name>/SKILL.md`. Examples: `pr-review`, `flutter-migration`. These get loaded on demand.

**Ceremonies = enforcement gates.** Code Review (3-pass with different models), Completion Gate, Implementation Plan Gate. See `.squad/ceremonies.md` — particularly the **Response Mode Selection** table (Direct / Lightweight / Standard / Full) which prevents over-engineering simple tasks.

**Traceability files = per-story logs.** One markdown file per JIRA story under `.squad/traceability/stories/COL-NNNNN.md`. Everything appended, nothing rewritten — the `COL-15813.md` is the canonical example in this repo.

**Decisions log = append-only ADRs.** `.squad/decisions.md`. Agents drop new ones into `decisions/inbox/` and a Scribe agent merges them.

## 4. Model Diversity for Reviews

The most powerful trick here: code review uses **three different models** (e.g., GPT for code quality, Gemini for tests, Claude for security). See `reviewModelOverrides` in `.squad/config.json`. Different models catch different bugs.

## 5. Bootstrap Order

1. Write `AGENTS.md` — stack, lint commands, file conventions, anti-patterns
2. Add `.squad/charter.md` + `.squad/team.md` with 2–3 agents
3. Add `.squad/ceremonies.md` with one gate: 3-pass code review
4. Add `.squad/skills/code-review/SKILL.md`
5. Use it on one story. Refine.
6. Add specialists (security, E2E, etc.) only when you feel the gap

## 6. Activation

Each session, point your AI at the structure with something like:

> "Read `.squad/charter.md`, `.squad/team.md`, and `AGENTS.md`. Act as the Coordinator. Route my request per `.squad/ceremonies.md → Response Mode Selection`."

Or bake it into `.github/copilot-instructions.md` / `CLAUDE.md` so it loads automatically — see `.squad/copilot-instructions.md` for the pattern this repo uses.

---

**Want a minimal `.squad/` scaffolded into a new project?** Provide the stack and 2–3 roles you want (e.g., "Lead + Dev + Tester") and the exact files to create can be outlined.
