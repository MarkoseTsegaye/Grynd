import path from 'node:path';
import process from 'node:process';
import { setMaxListeners } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { Agent, CursorAgentError } from '@cursor/sdk';

// Cursor SDK attaches AbortSignal listeners per run; disable warnings in long orchestrations.
setMaxListeners(0);

const REQUIRED_TICKET_SECTIONS = [
  '## Title',
  '## Context',
  '## Goal',
  '## Non-goals',
  '## Requirements',
  '## Acceptance criteria',
  '## Edge cases',
  '## Implementation notes',
  '## Test plan',
];

function ticketmanOutputInstructions() {
  return [
    'Output ONLY the ticket in Markdown.',
    'The ticket MUST include these exact section headers:',
    ...REQUIRED_TICKET_SECTIONS.map((s) => `- ${s}`),
    'Acceptance criteria MUST be a checklist using "- [ ]" items.',
    'Be specific about what files to touch in Implementation notes.',
    'In Test plan, include commands: "npm run typecheck" and "npm run lint" (and any manual steps if UI changes).',
  ].join('\n');
}

function validateTicketMarkdown(ticketMd) {
  const errors = [];
  for (const header of REQUIRED_TICKET_SECTIONS) {
    if (!ticketMd.includes(header)) errors.push(`Missing required section: "${header}"`);
  }
  const acMatch = (ticketMd + '\n## ').match(/\n## Acceptance criteria\s*\n([\s\S]*?)\n## /m);
  const acBody = acMatch?.[1] ?? '';
  if (!/^\s*-\s*\[\s*\]\s+\S+/m.test(acBody)) {
    errors.push('Acceptance criteria must include at least one checklist item like "- [ ] ...".');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

function buildTicketManPrompt(userRequest) {
  return `
You are TicketMan.

You write **well-scoped, refined engineering tickets** for the Grynd Expo/TypeScript app.

Repo conventions (follow these when proposing changes):
- Expo Router screens live in \`app/\`; shared logic/components live in \`src/\`.
- State is Zustand; persistence is AsyncStorage via \`src/storage/adapters/*\`.
- Prefer small, incremental changes. Avoid unnecessary refactors.

User request:
${userRequest.trim()}

Constraints:
${ticketmanOutputInstructions()}
`.trim();
}

function buildImplementerPrompt(ticketMd, failureContext) {
  const failureBlock = failureContext
    ? `\n\nTester/Reviewer feedback (MUST address all of this):\n${failureContext.trim()}\n`
    : '';

  return `
You are Implementer.

You write clean, functional code for the Grynd Expo/TypeScript app.

Rules:
- Implement exactly what the ticket requires; do not invent extra scope.
- Prefer minimal diffs and keep patterns consistent with existing code in \`app/\` and \`src/\`.
- Keep TypeScript strictness happy (must pass \`npm run typecheck\`).
- Must pass \`npm run lint\`.
- If you change behavior, update any related storage/store logic accordingly.
- After making changes, summarize which acceptance criteria are satisfied and where (file paths).

Ticket:
${ticketMd.trim()}
${failureBlock}
Now implement the ticket in the repository.
`.trim();
}

function buildTesterReviewerPrompt(ticketMd, gitDiff, toolOutputs, recentCommits) {
  const commitsBlock = recentCommits?.trim()
    ? `\n## Recent git commits (regression guard)\n\nIf the diff undoes behaviour described in any of these commits, that is a regression — mark FAIL.\n\n${recentCommits.trim()}\n`
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
Explicitly state whether the diff undoes any behaviour described in the recent commits.
If yes → FAIL.

### ## Typecheck
Pass or Fail + key errors.

### ## Lint
Pass or Fail + key errors.

### ## Risks / notes
Any logical issues spotted in the diff.

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

function nowSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function writeTextFile(filePath, contents) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, contents, 'utf8');
}

async function execCapture(command, args, opts) {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function runQualityGates(repoRoot) {
  const typecheck = await execCapture('npm', ['run', 'typecheck'], { cwd: repoRoot });
  const lint = await execCapture('npm', ['run', 'lint'], { cwd: repoRoot });
  return {
    typecheck: { code: typecheck.code, output: (typecheck.stdout + '\n' + typecheck.stderr).trim() },
    lint: { code: lint.code, output: (lint.stdout + '\n' + lint.stderr).trim() },
  };
}

async function getGitDiff(repoRoot) {
  const diff = await execCapture('git', ['diff'], { cwd: repoRoot });
  return (diff.stdout + '\n' + diff.stderr).trim();
}

async function getRecentCommits(repoRoot, n = 8) {
  const result = await execCapture('git', ['log', '--oneline', `-${n}`], { cwd: repoRoot });
  return (result.stdout + result.stderr).trim();
}

async function commitChanges(repoRoot, ticketMd) {
  const titleMatch = ticketMd.match(/^##\s+Title\s*\n(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? 'orchestrator run';
  const message = `[orchestrator] ${title}`;
  await execCapture('git', ['add', '-A'], { cwd: repoRoot });
  const commit = await execCapture('git', ['commit', '-m', message], { cwd: repoRoot });
  const out = (commit.stdout + commit.stderr).toLowerCase();
  if (commit.code !== 0 && !out.includes('nothing to commit') && !out.includes('nothing added')) {
    console.warn(`git commit warning (exit ${commit.code}):\n${commit.stdout}${commit.stderr}`);
  } else {
    console.log(`📦 Committed: "${message}"`);
  }
}

async function main() {
  const repoRoot = path.resolve(process.cwd());
  const userRequest = process.argv.slice(2).join(' ').trim();
  if (!userRequest) {
    console.error('Usage: npm run orchestrate -- "Describe the change you want"');
    process.exit(1);
  }

  const apiKey = requireEnv('CURSOR_API_KEY');
  const modelId = process.env.ORCH_MODEL ?? 'composer-2.5';
  const maxIters = Number(process.env.ORCH_MAX_ITERS ?? '3');

  const runDir = path.join(repoRoot, 'tickets', nowSlug());
  await ensureDir(runDir);
  await writeTextFile(path.join(runDir, 'request.txt'), userRequest + '\n');

  const agent = await Agent.create({
    apiKey,
    model: { id: modelId },
    local: { cwd: repoRoot },
  });

  try {
  let ticketMd = '';
  try {
    console.log('TicketMan: drafting ticket...');
    const ticketRun = await agent.send(buildTicketManPrompt(userRequest));
    const ticketResult = await ticketRun.wait();
    ticketMd = (ticketResult.result ?? '').trim();
  } catch (err) {
    if (err instanceof CursorAgentError) throw new Error(`TicketMan failed to start: ${err.message}`);
    throw err;
  }

  const ticketValidation = validateTicketMarkdown(ticketMd);
  if (!ticketValidation.ok) {
    await writeTextFile(path.join(runDir, 'ticket.invalid.md'), ticketMd + '\n');
    throw new Error(`TicketMan output invalid:\n- ${ticketValidation.errors.join('\n- ')}`);
  }
  await writeTextFile(path.join(runDir, 'ticket.md'), ticketMd + '\n');

  const recentCommits = await getRecentCommits(repoRoot);

  let lastFailureContext;
  for (let iter = 1; iter <= maxIters; iter++) {
    let implementerSummary = '';
    try {
      console.log(`Implementer: iteration ${iter}...`);
      const implRun = await agent.send(buildImplementerPrompt(ticketMd, lastFailureContext));
      const implResult = await implRun.wait();
      implementerSummary = (implResult.result ?? '').trim();
    } catch (err) {
      if (err instanceof CursorAgentError) throw new Error(`Implementer failed to start: ${err.message}`);
      throw err;
    }
    await writeTextFile(path.join(runDir, `implementer-${iter}.md`), implementerSummary + '\n');

    console.log(`Gates: npm run typecheck + lint (iteration ${iter})...`);
    const gates = await runQualityGates(repoRoot);
    const diff = await getGitDiff(repoRoot);
    const toolOutputs = [
      `# Iteration ${iter}`,
      '',
      '## npm run typecheck',
      `exitCode=${gates.typecheck.code}`,
      gates.typecheck.output || '(no output)',
      '',
      '## npm run lint',
      `exitCode=${gates.lint.code}`,
      gates.lint.output || '(no output)',
    ].join('\n');
    await writeTextFile(path.join(runDir, `gates-${iter}.txt`), toolOutputs + '\n');
    await writeTextFile(path.join(runDir, `diff-${iter}.patch`), diff + '\n');

    let review = '';
    try {
      console.log(`TesterReviewer: review iteration ${iter}...`);
      const testRun = await agent.send(buildTesterReviewerPrompt(ticketMd, diff, toolOutputs, recentCommits));
      const testResult = await testRun.wait();
      review = (testResult.result ?? '').trim();
    } catch (err) {
      if (err instanceof CursorAgentError) throw new Error(`TesterReviewer failed to start: ${err.message}`);
      throw err;
    }
    await writeTextFile(path.join(runDir, `review-${iter}.md`), review + '\n');

    // Match plain PASS or markdown-bold **PASS** / *PASS* on the line after ## Verdict.
    const verdictPass = /^##\s*Verdict\s*\n+\s*\*{0,2}PASS\*{0,2}\s*$/im.test(review);
    const gatesPass = gates.typecheck.code === 0 && gates.lint.code === 0;

    if (verdictPass && gatesPass) {
      await writeTextFile(path.join(runDir, 'FINAL.md'), review + '\n');
      await commitChanges(repoRoot, ticketMd);
      console.log(`PASS ✅  Artifacts: ${path.relative(repoRoot, runDir)}`);
      return;
    }

    lastFailureContext = [
      `Iteration ${iter} failed.`,
      '',
      '### Quality gates',
      `- typecheck exitCode=${gates.typecheck.code}`,
      `- lint exitCode=${gates.lint.code}`,
      '',
      '### Reviewer report',
      review,
    ].join('\n');
  }

  throw new Error(`Failed after ${maxIters} iterations. See artifacts in ${path.relative(repoRoot, runDir)}.`);
  } finally {
    await agent[Symbol.asyncDispose]?.();
  }
}

await main();

