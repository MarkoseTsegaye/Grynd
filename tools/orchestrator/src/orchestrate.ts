import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { Agent, CursorAgentError } from '@cursor/sdk';
import { loadSquadConfig } from './config';
import { execCapture } from './exec';
import { writeTextFile, ensureDir } from './fs';
import { runQualityGates, formatGateOutputs } from './gates';
import { validateTicketMarkdown } from './ticketTemplate';
import { extractAffectedPaths, extractTicketTitle } from './ticketUtils';
import { allReviewsPass } from './verdict';
import { appendTraceabilityEntry } from './traceability';
import { buildTicketManPrompt } from './agents/ticketman';
import { buildImplementerPrompt } from './agents/implementer';
import { buildCodeReviewPrompt, REVIEW_PASSES, type ReviewPass } from './agents/codeReview';
import { buildDecisionLogPrompt } from './agents/decisionLog';

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

async function getGitDiff(repoRoot: string): Promise<string> {
  const diff = await execCapture('git', ['diff'], { cwd: repoRoot });
  return (diff.stdout + '\n' + diff.stderr).trim();
}

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

async function getUncommittedChangesForFiles(repoRoot: string, paths: string[]): Promise<string> {
  if (paths.length === 0) return '';
  const result = await execCapture('git', ['diff', 'HEAD', '--', ...paths], { cwd: repoRoot });
  return (result.stdout + result.stderr).trim();
}

async function getRecentCommits(repoRoot: string, n = 8): Promise<string> {
  const result = await execCapture('git', ['log', '--oneline', `-${n}`], { cwd: repoRoot });
  return (result.stdout + result.stderr).trim();
}

async function commitChanges(repoRoot: string, title: string): Promise<void> {
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

async function runAgent(
  apiKey: string,
  modelId: string,
  repoRoot: string,
  prompt: string,
  label: string,
): Promise<string> {
  try {
    await using agent = await Agent.create({
      apiKey,
      model: { id: modelId },
      local: { cwd: repoRoot },
    });
    const run = await agent.send(prompt);
    const result = await run.wait();
    return (result.result ?? '').trim();
  } catch (err) {
    if (err instanceof CursorAgentError) throw new Error(`${label} failed to start: ${err.message}`);
    throw err;
  }
}

function reviewModelForPass(
  pass: ReviewPass,
  overrides: { pass1_codeQuality: string; pass2_tests: string; pass3_security: string },
): string {
  return overrides[pass];
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
  const squad = await loadSquadConfig(repoRoot);
  const maxIters = Number(process.env.ORCH_MAX_ITERS ?? String(squad.defaults.maxIterations));
  const modelOverride = process.env.ORCH_MODEL;

  const runDir = path.join(repoRoot, 'tickets', nowSlug());
  await ensureDir(runDir);
  await writeTextFile(path.join(runDir, 'request.txt'), userRequest + '\n');

  // ── Coordinator / TicketMan ─────────────────────────────────────────────────
  // eslint-disable-next-line no-console
  console.log('Coordinator (TicketMan): drafting ticket...');
  const coordinatorModel = modelOverride ?? squad.models.coordinator;
  let ticketMd = await runAgent(apiKey, coordinatorModel, repoRoot, buildTicketManPrompt(userRequest), 'TicketMan');

  const ticketValidation = validateTicketMarkdown(ticketMd);
  if (!ticketValidation.ok) {
    await writeTextFile(path.join(runDir, 'ticket.invalid.md'), ticketMd + '\n');
    throw new Error(`TicketMan output invalid:\n- ${ticketValidation.errors.join('\n- ')}`);
  }
  await writeTextFile(path.join(runDir, 'ticket.md'), ticketMd + '\n');

  const title = extractTicketTitle(ticketMd);
  const affectedPaths = extractAffectedPaths(ticketMd);
  const affectedFileContents = await readAffectedFiles(repoRoot, affectedPaths);
  const recentCommits = await getRecentCommits(repoRoot);
  const uncommittedChanges = await getUncommittedChangesForFiles(repoRoot, affectedPaths);

  // ── Implement → Gate → 3-pass Review loop ───────────────────────────────────
  let lastFailureContext: string | undefined;
  const devModel = modelOverride ?? squad.models.dev;

  for (let iter = 1; iter <= maxIters; iter++) {
    // eslint-disable-next-line no-console
    console.log(`Dev (Implementer): iteration ${iter}...`);
    const implementerSummary = await runAgent(
      apiKey,
      devModel,
      repoRoot,
      buildImplementerPrompt({
        ticketMd,
        affectedFileContents,
        recentCommits,
        uncommittedChanges,
        failureContext: lastFailureContext,
      }),
      'Implementer',
    );
    await writeTextFile(path.join(runDir, `implementer-${iter}.md`), implementerSummary + '\n');

    // eslint-disable-next-line no-console
    console.log(`Gates: typecheck + lint + test (iteration ${iter})...`);
    const gateRun = await runQualityGates(repoRoot, squad.gates);
    const diff = await getGitDiff(repoRoot);
    const toolOutputs = formatGateOutputs(gateRun.results, iter);
    await writeTextFile(path.join(runDir, `gates-${iter}.txt`), toolOutputs + '\n');
    await writeTextFile(path.join(runDir, `diff-${iter}.patch`), diff + '\n');

    if (!gateRun.pass) {
      lastFailureContext = [
        `Iteration ${iter} failed — quality gates did not pass.`,
        '',
        '### Quality gates',
        ...gateRun.results.map((r) => `- ${r.command} exitCode=${r.code}`),
      ].join('\n');
      continue;
    }

    // 3-pass review with different models
    const reviews: string[] = [];
    for (const pass of REVIEW_PASSES) {
      const reviewModel = modelOverride ?? reviewModelForPass(pass, squad.reviewModelOverrides);
      // eslint-disable-next-line no-console
      console.log(`Review ${pass} (${reviewModel})...`);
      const review = await runAgent(
        apiKey,
        reviewModel,
        repoRoot,
        buildCodeReviewPrompt({ pass, ticketMd, gitDiff: diff, toolOutputs, recentCommits }),
        `Review-${pass}`,
      );
      reviews.push(review);
      await writeTextFile(path.join(runDir, `review-${iter}-${pass}.md`), review + '\n');
    }

    const combinedReview = reviews
      .map((r, i) => `# Pass ${i + 1} (${REVIEW_PASSES[i]})\n\n${r}`)
      .join('\n\n---\n\n');

    if (allReviewsPass(reviews)) {
      await writeTextFile(path.join(runDir, 'FINAL.md'), combinedReview + '\n');

      const storyPath = await appendTraceabilityEntry({
        repoRoot,
        title,
        runDir,
        ticketMd,
        finalReview: combinedReview,
      });
      // eslint-disable-next-line no-console
      console.log(`Traceability: ${path.relative(repoRoot, storyPath)}`);

      // DecisionLog — update history.md
      const historyPath = 'tools/orchestrator/history.md';
      let existingHistory = '';
      try {
        existingHistory = await readFile(path.join(repoRoot, historyPath), 'utf-8');
      } catch {
        /* empty */
      }

      // eslint-disable-next-line no-console
      console.log('DecisionLog: updating history...');
      const decisionSummary = await runAgent(
        apiKey,
        squad.models.lead,
        repoRoot,
        buildDecisionLogPrompt({
          ticketMd,
          gitDiff: diff,
          reviewerReport: combinedReview,
          historyPath,
          existingHistoryMd: existingHistory,
        }),
        'DecisionLog',
      );
      await writeTextFile(path.join(runDir, 'decision-log.md'), decisionSummary + '\n');

      await commitChanges(repoRoot, title);
      // eslint-disable-next-line no-console
      console.log(`PASS ✅ Artifacts: ${path.relative(repoRoot, runDir)}`);
      return;
    }

    lastFailureContext = [
      `Iteration ${iter} failed — one or more review passes returned FAIL.`,
      '',
      '### Review reports',
      combinedReview,
    ].join('\n');
  }

  throw new Error(`Failed after ${maxIters} iterations. See artifacts in ${path.relative(repoRoot, runDir)}.`);
}

void main();
