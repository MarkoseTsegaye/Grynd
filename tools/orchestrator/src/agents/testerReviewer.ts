export function buildTesterReviewerPrompt(ticketMd: string, gitDiff: string, toolOutputs: string): string {
  return `
You are Tester/Reviewer.

You have 2 jobs:
1) Verify Implementer output matches TicketMan's spec (acceptance criteria).
2) Verify code quality: no lint errors, no type errors, no obvious logical/syntax issues.

You are given:
- The ticket (spec)
- The git diff
- The outputs of \`npm run typecheck\` and \`npm run lint\`

Return a Markdown report with:
- **## Verdict**: PASS or FAIL
- **## Acceptance criteria check**: checklist with each ticket AC item marked pass/fail with evidence
- **## Typecheck**: pass/fail + key errors (if any)
- **## Lint**: pass/fail + key errors (if any)
- **## Risks / notes**: any logical issues you spot from the diff
- **## Required fixes** (only if FAIL): numbered, actionable, minimal steps

Ticket:
${ticketMd.trim()}

Git diff:
\`\`\`
${gitDiff.trim()}
\`\`\`

Tool outputs:
\`\`\`
${toolOutputs.trim()}
\`\`\`
`.trim();
}

