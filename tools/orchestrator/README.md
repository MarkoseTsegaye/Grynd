# Grynd Orchestrator (Ticket → Implement → Test)

This folder contains a small orchestrator CLI that uses the Cursor SDK to run a 3-agent workflow:

- `TicketMan`: writes a well-scoped Markdown ticket/spec
- `Implementer`: makes repo changes to satisfy the ticket
- `TesterReviewer`: verifies the result matches the ticket and that repo quality gates pass

## Usage

From the repo root:

```bash
npm run orchestrate -- "Describe the change you want"
```

### Environment

- `CURSOR_API_KEY` (required)
- `ORCH_MODEL` (optional, default: `composer-2.5`)
- `ORCH_MAX_ITERS` (optional, default: `3`)

