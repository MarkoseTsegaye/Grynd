import path from 'node:path';
import process from 'node:process';
import { Agent, CursorAgentError } from '@cursor/sdk';
import { execCapture } from './exec';
import { writeTextFile, ensureDir } from './fs';
import { validateTicketMarkdown } from './ticketTemplate';
import { buildTicketManPrompt } from './agents/ticketman';
import { buildImplementerPrompt } from './agents/implementer';
import { buildTesterReviewerPrompt } from './agents/testerReviewer';

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

async function main() {
  // tsx runs TypeScript directly; keep repoRoot resolution robust across runtimes.
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

  let lastFailureContext: string | undefined;
  for (let iter = 1; iter <= maxIters; iter++) {
    let implementerSummary = '';
    try {
      await using implAgent = await Agent.create({
        apiKey,
        model: { id: modelId },
        local: { cwd: repoRoot },
      });
      const implRun = await implAgent.send(buildImplementerPrompt(ticketMd, lastFailureContext));
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
      const testRun = await testAgent.send(buildTesterReviewerPrompt(ticketMd, diff, toolOutputs));
      const testResult = await testRun.wait();
      review = (testResult.result ?? '').trim();
    } catch (err) {
      if (err instanceof CursorAgentError) throw new Error(`TesterReviewer failed to start: ${err.message}`);
      throw err;
    }
    await writeTextFile(path.join(runDir, `review-${iter}.md`), review + '\n');

    const verdictPass = /^##\s+Verdict\s*\n\s*PASS\s*$/im.test(review) || /\bVerdict\b.*\bPASS\b/i.test(review);
    const gatesPass = gates.typecheck.code === 0 && gates.lint.code === 0;

    if (verdictPass && gatesPass) {
      await writeTextFile(path.join(runDir, 'FINAL.md'), review + '\n');
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

