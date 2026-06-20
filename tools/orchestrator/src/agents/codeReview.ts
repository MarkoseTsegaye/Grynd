export type ReviewPass = 'pass1_codeQuality' | 'pass2_tests' | 'pass3_security';

export interface CodeReviewOptions {
  pass: ReviewPass;
  ticketMd: string;
  gitDiff: string;
  toolOutputs: string;
  recentCommits: string;
}

const PASS_FOCUS: Record<ReviewPass, { role: string; skill: string; focus: string }> = {
  pass1_codeQuality: {
    role: 'Lead (Pass 1 — Code Quality)',
    skill: '.squad/skills/code-review/SKILL.md',
    focus: 'scope creep, patterns, minimal diff, AGENTS.md compliance',
  },
  pass2_tests: {
    role: 'Tester (Pass 2 — Tests & AC)',
    skill: '.squad/skills/testing/SKILL.md',
    focus: 'acceptance criteria evidence, test gate, regressions, missing tests',
  },
  pass3_security: {
    role: 'Lead (Pass 3 — Security)',
    skill: '.squad/skills/code-review/SKILL.md',
    focus: 'secrets, data validation, unsafe patterns, AsyncStorage safety',
  },
};

export function buildCodeReviewPrompt(opts: CodeReviewOptions): string {
  const { pass, ticketMd, gitDiff, toolOutputs, recentCommits } = opts;
  const meta = PASS_FOCUS[pass];

  const commitsBlock = recentCommits.trim()
    ? `\n## Recent git commits (regression guard)\n\nIf the diff undoes behaviour described in any of these commits, that is a regression — mark FAIL.\n\n${recentCommits.trim()}\n`
    : '';

  return `
You are ${meta.role}.

Follow ${meta.skill}. Focus: ${meta.focus}.

## Required report format

### ## Verdict
Write exactly one word on its own line: PASS or FAIL (plain text, no bold/italic).

### ## Findings
Bullet list of what you checked and what you found.

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

export const REVIEW_PASSES: ReviewPass[] = ['pass1_codeQuality', 'pass2_tests', 'pass3_security'];
