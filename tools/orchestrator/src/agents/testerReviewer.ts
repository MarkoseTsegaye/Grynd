export interface TesterReviewerOptions {
  ticketMd: string;
  gitDiff: string;
  toolOutputs: string;
  recentCommits: string;
}

export function buildTesterReviewerPrompt(opts: TesterReviewerOptions): string {
  const { ticketMd, gitDiff, toolOutputs, recentCommits } = opts;

  const commitsBlock = recentCommits.trim()
    ? `\n## Recent git commits (regression guard)\n\nIf the diff undoes behaviour described in any of these commits, that is a regression — mark it as FAIL.\n\n${recentCommits.trim()}\n`
    : '';

  return `
You are Tester/Reviewer.

Your two jobs:
1. Verify the diff satisfies every acceptance criterion in the ticket.
2. Verify code quality: no type errors, no lint errors, no obvious regressions.

## Required report format

### ## Verdict
Write exactly one word on its own line: PASS or FAIL (plain text, no bold/italic).

### ## Acceptance criteria check
Checklist — each AC item marked [x] pass or [ ] fail with evidence from the diff.

### ## Regression check
Explicitly state whether the diff undoes any behaviour described in the recent commits below.
If yes → FAIL.

### ## Typecheck
Pass or Fail + key errors.

### ## Lint
Pass or Fail + key errors.

### ## Risks / notes
Any logical issues spotted in the diff (scope creep, accidental deletions, etc.).

### ## Required fixes
(Only present if FAIL) — numbered, actionable, minimal steps to reach PASS.

---
${commitsBlock}
## Ticket

${ticketMd.trim()}

## Git diff

\`\`\`diff
${gitDiff.trim()}
\`\`\`

## Tool outputs

\`\`\`
${toolOutputs.trim()}
\`\`\`
`.trim();
}
