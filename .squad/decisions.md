# Grynd Architecture Decisions (ADR log)

Append-only. New decisions go at the bottom. Outdated entries are struck through, not deleted.

---

## ADR-001: Squad orchestration convention

**Date:** 2026-06-15  
**Status:** Accepted

Grynd uses a `.squad/` markdown convention (not a framework) for multi-agent workflows. The CLI orchestrator in `tools/orchestrator/` implements the Standard ceremony: TicketMan → Implementer → gates → 3-pass review → DecisionLog.

**Rationale:** Any AI tool that reads repo files can participate; no vendor lock-in.

---

## ADR-002: Quality gates include unit tests

**Date:** 2026-06-15  
**Status:** Accepted

All orchestrator runs must pass `npm run typecheck`, `npm run lint`, and `npm run test` before review.

**Rationale:** TypeScript and ESLint catch syntax issues; Vitest catches logic regressions in pure functions and orchestrator utilities.
