/**
 * drain.mjs — sequential orchestrator queue runner
 *
 * Reads tasks from queue.txt one line at a time, runs `npm run orchestrate`
 * on each, waits for it to finish, then moves to the next.
 *
 * Usage:
 *   npm run orchestrate:drain
 *
 * Add tasks to tools/orchestrator/queue.txt — one request per line.
 * Lines starting with # are treated as comments and skipped.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = path.join(__dirname, 'queue.txt');
const repoRoot = path.resolve(__dirname, '..', '..');

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[drain ${ts}] ${msg}`);
}

async function readQueue() {
  if (!existsSync(QUEUE_FILE)) return [];
  const raw = await readFile(QUEUE_FILE, 'utf-8');
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

async function writeQueue(lines) {
  // Preserve comment header lines at the top of the file.
  const existing = existsSync(QUEUE_FILE)
    ? (await readFile(QUEUE_FILE, 'utf-8')).split('\n')
    : [];
  const header = existing.filter((l) => l.startsWith('#'));
  const body = lines.map((l) => l.trim()).filter(Boolean);
  await writeFile(QUEUE_FILE, [...header, ...body].join('\n') + '\n', 'utf-8');
}

function runOrchestrate(request) {
  return new Promise((resolve) => {
    log(`Starting: "${request}"`);
    const child = spawn('npm', ['run', 'orchestrate', '--', request], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    });
    child.on('close', (code) => {
      if (code === 0) {
        log(`✅  Done: "${request}"`);
      } else {
        log(`❌  Failed (exit ${code}): "${request}"`);
      }
      resolve(code ?? 1);
    });
  });
}

async function main() {
  log('Queue runner started. Reading queue.txt…');

  let processed = 0;
  let failed = 0;

  while (true) {
    const tasks = await readQueue();

    if (tasks.length === 0) {
      log(`Queue empty. Processed ${processed} task(s), ${failed} failed. Exiting.`);
      break;
    }

    const [next, ...rest] = tasks;

    // Remove the task from the queue before running it so a crash doesn't re-run it.
    await writeQueue(rest);
    log(`Queue: ${tasks.length} task(s) remaining after this one.`);

    const code = await runOrchestrate(next);
    processed++;
    if (code !== 0) failed++;
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
