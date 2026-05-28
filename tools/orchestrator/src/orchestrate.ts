import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { Agent, CursorAgentError } from '@cursor/sdk';
import { execCapture } from './exec';
import { writeTextFile, ensureDir } from './fs';
import { validateTicketMarkdown } from './ticketTemplate';
import { buildTicketManPrompt } from './agents/ticketman';
import { buildImplementerPrompt } from './agents/implementer';
import { buildTesterReviewerPrompt } from './agents/testerReviewer';

// ── Helpers ──────────────────────────────────────────────────────────────────

function nowSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function runQualityGates(repoRoot: string): Promise<{
  typecheck: { code: number; output: string };
  lint: { code: number; output: string };
}> {
  const typecheck = await execCapture('npm', ['run', 'typecheck'], { cwd: repoRoot });
  const lint = await execCapture('npm', ['run', 'lint'], { cwd: repoRoot });
  return {
    typecheck: { code: typecheck.code, output: (typecheck.stdout + '\n' + typecheck.stderr).trim() },
    lint: { code: lint.code, output: (lint.stdout + '\n' + lint.stderr).trim() },
  };
}

async function getGitDiff(repoRoot: string): Promise<string> {
  const diff = await execCapture('git', ['diff'], { cwd: repoRoot });
  return (diff.stdout + '\n' + diff.stderr).trim();
}

/** Extract file paths from the ticket's ## Affected files section. */
function extractAffectedPaths(ticketMd: string): string[] {
  const match = (ticketMd + '\n## ').match(/## Affected files\s*\n([\s\S]*?)\n## /m);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('/') || l.endsWith('.ts') || l.endsWith('.tsx'));
}

/** Read each affected file (or note it doesn't exist yet). */
async function readAffectedFiles(repoRoot: string, paths: string[]): Promise<string> {
  if (paths.length === 0) return '(no affected files listed in ticket)';
  const sections = await Promise.all(
    paths.map(async (p) => {
      try {
        const content = await readFile(path.join(repoRoot, p), 'utf-8');
        return `### ${p}\n\`\`\`ts\n${content}\n\`\`\``;
      } catch {
        return `### ${p}\n(file does not exist yet — will be created)`;
      }
    }),
  );
  return sections.join('\n\n');
}

/**
 * Show what changed in the affected files since the last git commit.
 * This tells the Implementer what previous (uncommitted) runs already fixed
 * so it does not accidentally undo that work.
 */
async function getUncommittedChangesForFiles(repoRoot: string, paths: string[]): Promise<string> {
  if (paths.length === 0) return '';
  const result = await execCapture('git', ['diff', 'HEAD', '--', ...paths], { cwd: repoRoot });
  return (result.stdout + result.stderr).trim();
}

/** Return the last N commit messages — lets agents know what was recently fixed. */
async function getRecentCommits(repoRoot: string, n = 8): Promise<string> {
  const result = await execCapture('git', ['log', '--oneline', `-${n}`], { cwd: repoRoot });
  return (result.stdout + result.stderr).trim();
}

/**
 * Commit all working-tree changes after a successful run.
 * Creates a stable rollback point so the next run always has a clean HEAD.
 */
async function commitChanges(repoRoot: string, ticketMd: string): Promise<void> {
  const titleMatch = ticketMd.match(/^##\s+Title\s*\n(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? 'orchestrator run';
  const message = `[orchestrator] ${title}`;

  await execCapture('git', ['add', '-A'], { cwd: repoRoot });
  const commit = await execCapture('git', ['commit', '-m', message], { cwd: repoRoot });
  const out = (commit.stdout + commit.stderr).toLowerCase();
  if (commit.code !== 0 && !out.includes('nothing to commit') && !out.includes('nothing added')) {
    // eslint-disable-next-line no-console
    console.warn(`git commit warning (exit ${commit.code}):\n${commit.stdout}${commit.stderr}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`📦 Committed: "${message}"`);
  }
}

function parseVerdictPass(review: string): boolean {
  // Accept plain PASS or markdown-bold **PASS** / *PASS* on the line after ## Verdict.
  return /^##\s*Verdict\s*\n+\s*\*{0,2}PASS\*{0,2}\s*$/im.test(review);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const repoRoot = path.resolve(process.cwd());
  const userRequest = process.argv.slice(2).join(' ').trim();
  if (!userRequest) {
    // eslint-disable-next-line no-console
    console.error('Usage: npm run orchestrate -- "Describe the change you want"');
    process.exit(1);
  }

  const apiKey = requireEnv('CURSOR_API_KEY');
  const modelId = process.env.ORCH_MODEL ?? 'composer-2.5';
  const maxIters = Number(process.env.ORCH_MAX_ITERS ?? '3');

  const runDir = path.join(repoRoot, 'tickets', nowSlug());
  await ensureDir(runDir);
  await writeTextFile(path.join(runDir, 'request.txt'), userRequest + '\n');

  // ── TicketMan ───────────────────────────────────────────────────────────────
  let ticketMd = '';
  try {
    await using ticketAgent = await Agent.create({
      apiKey,
      model: { id: modelId },
      local: { cwd: repoRoot },
    });
    const ticketRun = await ticketAgent.send(buildTicketManPrompt(userRequest));
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

  // Gather context used by every iteration.
  const affectedPaths = extractAffectedPaths(ticketMd);
  const affectedFileContents = await readAffectedFiles(repoRoot, affectedPaths);
  const recentCommits = await getRecentCommits(repoRoot);
  const uncommittedChanges = await getUncommittedChangesForFiles(repoRoot, affectedPaths);

  // ── Implement → Gate → Review loop ─────────────────────────────────────────
  let lastFailureContext: string | undefined;
  for (let iter = 1; iter <= maxIters; iter++) {
    let implementerSummary = '';
    try {
      await using implAgent = await Agent.create({
        apiKey,
        model: { id: modelId },
        local: { cwd: repoRoot },
      });
      const implRun = await implAgent.send(
        buildImplementerPrompt({
          ticketMd,
          affectedFileContents,
          recentCommits,
          uncommittedChanges,
          failureContext: lastFailureContext,
        }),
      );
      const implResult = await implRun.wait();
      implementerSummary = (implResult.result ?? '').trim();
    } catch (err) {
      if (err instanceof CursorAgentError) throw new Error(`Implementer failed to start: ${err.message}`);
      throw err;
    }
    await writeTextFile(path.join(runDir, `implementer-${iter}.md`), implementerSummary + '\n');

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
      await using testAgent = await Agent.create({
        apiKey,
        model: { id: modelId },
        local: { cwd: repoRoot },
      });
      const testRun = await testAgent.send(
        buildTesterReviewerPrompt({ ticketMd, gitDiff: diff, toolOutputs, recentCommits }),
      );
      const testResult = await testRun.wait();
      review = (testResult.result ?? '').trim();
    } catch (err) {
      if (err instanceof CursorAgentError) throw new Error(`TesterReviewer failed to start: ${err.message}`);
      throw err;
    }
    await writeTextFile(path.join(runDir, `review-${iter}.md`), review + '\n');

    const gatesPass = gates.typecheck.code === 0 && gates.lint.code === 0;

    if (parseVerdictPass(review) && gatesPass) {
      await writeTextFile(path.join(runDir, 'FINAL.md'), review + '\n');
      // Commit so the next run has a stable HEAD to compare against.
      await commitChanges(repoRoot, ticketMd);
      // eslint-disable-next-line no-console
      console.log(`PASS ✅ Artifacts: ${path.relative(repoRoot, runDir)}`);
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
}

void main();
