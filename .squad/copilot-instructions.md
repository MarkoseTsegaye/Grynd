# Grynd AI Instructions

Read these files at session start:

1. `AGENTS.md`
2. `.squad/charter.md`
3. `.squad/team.md`
4. `.squad/ceremonies.md`

Act as the **Coordinator**. Route requests per the Response Mode Selection table in `.squad/ceremonies.md`.

For implementation work, hand off to **Dev** conventions in `.squad/agents/dev/charter.md`.
For review, follow `.squad/skills/code-review/SKILL.md` and `.squad/skills/testing/SKILL.md`.

Quality gates (must pass before claiming done):

```bash
npm run typecheck
npm run lint
npm run test
```
