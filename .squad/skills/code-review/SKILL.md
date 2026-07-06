# Code Review Skill

Load when performing Pass 1 (quality) or Pass 3 (security) reviews.

## Pass 1 — Code quality

Check:

- [ ] Diff matches ticket scope — no unrelated files
- [ ] Follows `AGENTS.md` patterns (Expo Router, Zustand, NativeWind)
- [ ] TypeScript strict — no `any` escapes without justification
- [ ] Minimal diff — no full-file rewrites
- [ ] Naming matches surrounding code

## Pass 3 — Security & data

Check:

- [ ] No secrets in diff (`.env`, API keys, tokens)
- [ ] AsyncStorage data validated on read (backup/import paths)
- [ ] User input sanitized where persisted
- [ ] No unsafe `eval`, dynamic requires, or shell commands
- [ ] File paths from user/document picker handled safely

## Report structure

```markdown
## Verdict
PASS

## Scope check
...

## Pattern check
...

## Security check
(Pass 3 only)

## Required fixes
(Only if FAIL)
```
