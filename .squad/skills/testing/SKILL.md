# Testing Skill

Load when performing Pass 2 (tests & acceptance criteria) reviews.

## Pass 2 — Tests & AC

Check:

- [ ] Every acceptance criterion has diff evidence
- [ ] `npm run test` exit code is 0
- [ ] New pure functions / utilities have unit tests
- [ ] No regression against recent commit messages
- [ ] Test plan in ticket was followed

## When tests are required

| Change type | Test expectation |
|---|---|
| New utility in `src/shared/lib/` | Unit test in `__tests__/` |
| Store logic change | Unit test for state transitions |
| UI-only styling | Manual test plan OK; no unit test required |
| Orchestrator change | Test in `tools/orchestrator/src/__tests__/` |

## Report structure

```markdown
## Verdict
PASS

## Acceptance criteria check
- [x] AC item — evidence: `file.ts` line N

## Test gate
Pass / Fail + output summary

## Regression check
...

## Required fixes
(Only if FAIL)
```
